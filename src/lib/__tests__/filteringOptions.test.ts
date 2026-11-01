/**
 * Headless-проверки фильтра вариантов (ADR 0048): условия select / multiselect /
 * lookup, варианты из данных, фасетные счётчики, подписи в поиске и экспорте.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { optionLabelOf, rememberOptionLabels } from '../core/columnOptions'
import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { type DataMode, manualOptionsOf } from '../core/dataMode'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { columnFiltering } from '../plugins/columnFiltering'
import type { ColumnFilterValue } from '../plugins/columnFiltering'
import {
  filterOptionsOf,
  optionCountsOf,
} from '../plugins/columnFilteringModel/options'
import { dataExport } from '../plugins/dataExport'
import { collectExportData } from '../plugins/dataExportModel/exportData'
import { quickSearch } from '../plugins/quickSearch'

interface Item {
  id: string
  status: string | null
  tags: string[] | null
  manager: string
  city: string
}

const DATA: Item[] = [
  {
    id: '1',
    status: 'lead',
    tags: ['vip', 'partner'],
    manager: 'm1',
    city: 'Rome',
  },
  { id: '2', status: 'won', tags: ['vip'], manager: 'm2', city: 'Paris' },
  { id: '3', status: 'lost', tags: [], manager: 'm1', city: 'Berlin' },
  { id: '4', status: null, tags: null, manager: 'm3', city: 'Paris' },
  { id: '5', status: 'archived', tags: ['partner'], manager: 'm2', city: '' },
  { id: '6', status: 'won', tags: ['vip', 'new'], manager: 'm1', city: 'Rome' },
]

const STATUS = [
  { value: 'lead', label: 'Lead' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]
const TAGS = [
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'Partner' },
  { value: 'new', label: 'New' },
]
const MANAGERS: Record<string, string> = { m1: 'Alice Moss', m2: 'Bob Reed' }

const COLUMNS = [
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    options: STATUS,
    dataType: 'select',
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Tags',
    options: TAGS,
    dataType: 'multiSelect',
  },
  {
    id: 'manager',
    accessorKey: 'manager',
    header: 'Manager',
    getOptionLabel: (id: string) => MANAGERS[id],
    dataType: 'select',
    loadOptions: async () => [],
  },
  { id: 'city', accessorKey: 'city', header: 'City', dataType: 'select' },
]

const build = (plugins: any[] = [columnFiltering()], dataMode?: DataMode) => {
  const entries = [
    {
      id: 'reactivity',
      features: { coreReactivityFeature: storeReactivityBindings() },
    },
    ...plugins,
  ]
  const folded = foldEntries(entries)
  return constructTable({
    features: buildTesseraFeatures(entries as never),
    data: DATA,
    columns: injectServiceColumns(COLUMNS as any[], folded.serviceColumns),
    getRowId: (row: Item) => row.id,
    ...folded.options,
    dataMode,
    ...manualOptionsOf({ ...folded.options, dataMode }),
    hooks: resolveHooks(foldHooks(entries)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
  } as never) as any
}

const ids = (table: any): string[] =>
  table.getRowModel().rows.map((row: { id: string }) => row.id)

const filtered = (columnId: string, filter: ColumnFilterValue) => {
  const table = build()
  table.setColumnFilters([{ id: columnId, value: filter }])
  return ids(table)
}

describe('columnFiltering — варианты', () => {
  it('SF2: без options варианты — уникальные значения колонки; значение вне options показано сырым; в серверном режиме варианты из данных не собираются', () => {
    const table = build()
    expect(filterOptionsOf(table, table.getColumn('city'))).toEqual([
      { value: 'Berlin', label: 'Berlin' },
      { value: 'Paris', label: 'Paris' },
      { value: 'Rome', label: 'Rome' },
    ])
    // Явные options — как заданы, в своём порядке.
    expect(filterOptionsOf(table, table.getColumn('status'))).toBe(STATUS)
    // Значение вне options подписывается сырым.
    expect(optionLabelOf(table, table.getColumn('status'), 'archived')).toBe(
      'archived',
    )
    expect(
      table
        .getRowModel()
        .rows[4].getAllCells()[0]
        .column.columnDef.cell({
          table,
          column: table.getColumn('status'),
          getValue: () => 'archived',
          renderValue: () => 'archived',
        }),
    ).toBe('archived')

    const server = build([columnFiltering({ onFilterChange: () => {} })], {
      filtering: 'server',
    })
    expect(filterOptionsOf(server, server.getColumn('city'))).toEqual([])
    expect(filterOptionsOf(server, server.getColumn('status'))).toBe(STATUS)
  })

  it("SF3: select / lookup — «любое из», «ни одно из», «пусто» (null, undefined, ''), «не пусто»", () => {
    expect(
      filtered('status', { operator: 'anyOf', value: ['won', 'lead'] }),
    ).toEqual(['1', '2', '6'])
    expect(filtered('status', { operator: 'noneOf', value: ['won'] })).toEqual([
      '1',
      '3',
      '4',
      '5',
    ])
    expect(filtered('status', { operator: 'empty' })).toEqual(['4'])
    expect(filtered('city', { operator: 'empty' })).toEqual(['5'])
    expect(filtered('status', { operator: 'notEmpty' })).toEqual([
      '1',
      '2',
      '3',
      '5',
      '6',
    ])
    expect(filtered('manager', { operator: 'anyOf', value: ['m1'] })).toEqual([
      '1',
      '3',
      '6',
    ])
    expect(
      filtered('manager', { operator: 'noneOf', value: ['m1', 'm2'] }),
    ).toEqual(['4'])
  })

  it('SF4: multiselect — «любое из» (пересечение), «содержит все», «ни одно из», «пусто» (null, undefined, []), «не пусто»', () => {
    expect(
      filtered('tags', { operator: 'anyOf', value: ['partner', 'new'] }),
    ).toEqual(['1', '5', '6'])
    expect(
      filtered('tags', { operator: 'allOf', value: ['vip', 'partner'] }),
    ).toEqual(['1'])
    expect(filtered('tags', { operator: 'noneOf', value: ['vip'] })).toEqual([
      '3',
      '4',
      '5',
    ])
    expect(filtered('tags', { operator: 'empty' })).toEqual(['3', '4'])
    expect(filtered('tags', { operator: 'notEmpty' })).toEqual([
      '1',
      '2',
      '5',
      '6',
    ])
  })

  it('SF5: срез { operator, value: OptionValue[] } переживает JSON.stringify / JSON.parse без потерь; пустой выбор у условий со значением снимает фильтр', () => {
    const table = build()
    table.setColumnFilters([
      { id: 'status', value: { operator: 'anyOf', value: ['won'] } },
      { id: 'tags', value: { operator: 'allOf', value: ['vip', 'new'] } },
    ])
    const state = table.atoms.columnFilters.get()
    const restored = JSON.parse(JSON.stringify(state))
    expect(restored).toEqual(state)
    const again = build()
    again.setColumnFilters(restored)
    expect(ids(again)).toEqual(ids(table))
    expect(ids(table)).toEqual(['6'])

    for (const operator of ['anyOf', 'allOf', 'noneOf'] as const) {
      const empty = build()
      empty.setColumnFilters([{ id: 'tags', value: { operator, value: [] } }])
      expect(empty.atoms.columnFilters.get(), operator).toEqual([])
    }
  })

  it('SF8: счётчик варианта — строки, прошедшие остальные фильтры и поиск, без фильтра этой колонки; у multiselect строка считается в каждом своём значении', () => {
    const table = build([columnFiltering(), quickSearch()])
    const counts = (columnId: string) =>
      Object.fromEntries(
        optionCountsOf(table, table.getColumn(columnId))!.entries(),
      )
    expect(counts('tags')).toEqual({ vip: 3, partner: 2, new: 1 })
    expect(counts('status')).toEqual({ lead: 1, won: 2, lost: 1, archived: 1 })

    // Свой фильтр счётчики не сужает, чужой — сужает.
    table.setColumnFilters([
      { id: 'status', value: { operator: 'anyOf', value: ['won'] } },
    ])
    expect(counts('status')).toEqual({ lead: 1, won: 2, lost: 1, archived: 1 })
    expect(counts('tags')).toEqual({ vip: 2, new: 1 })

    // Поиск тоже сужает (по подписи менеджера).
    table.setGlobalFilter('bob')
    expect(counts('tags')).toEqual({ vip: 1 })
    expect(counts('status')).toEqual({ won: 1, archived: 1 })
  })

  it('SF14: подпись значения — options → getOptionLabel → кэш ответов loadOptions → значение строкой', () => {
    const table = build()
    const manager = table.getColumn('manager')
    const status = table.getColumn('status')
    expect(optionLabelOf(table, status, 'won')).toBe('Won')
    expect(optionLabelOf(table, manager, 'm1')).toBe('Alice Moss')
    expect(optionLabelOf(table, manager, 'm3')).toBe('m3')
    rememberOptionLabels(table, 'manager', [
      { value: 'm3', label: 'Carol Hale' },
      { value: 'm1', label: 'Не та подпись' },
    ])
    expect(optionLabelOf(table, manager, 'm3')).toBe('Carol Hale')
    // getOptionLabel важнее кэша, options важнее getOptionLabel.
    expect(optionLabelOf(table, manager, 'm1')).toBe('Alice Moss')
    // Кэш — на таблицу: у другой таблицы его нет.
    const other = build()
    expect(optionLabelOf(other, other.getColumn('manager'), 'm3')).toBe('m3')
  })
})

describe('варианты в соседних плагинах', () => {
  it('SF16: быстрый поиск ищет по подписям колонок с вариантами, а не по значениям', () => {
    const table = build([columnFiltering(), quickSearch()])
    table.setGlobalFilter('alice')
    expect(ids(table)).toEqual(['1', '3', '6'])
    table.setGlobalFilter('m2')
    expect(ids(table)).toEqual([])
    table.setGlobalFilter('partner')
    expect(ids(table)).toEqual(['1', '5'])
    table.setGlobalFilter('archived')
    expect(ids(table)).toEqual(['5'])
  })

  it('SF17: экспорт выгружает подписи колонок с вариантами, массив — через «, »; formatValue перекрывает', () => {
    const table = build([columnFiltering(), dataExport()])
    const data = collectExportData(table)
    expect(data.rows[0]).toEqual(['Lead', 'VIP, Partner', 'Alice Moss', 'Rome'])
    expect(data.rows[3]).toEqual(['', '', 'm3', 'Paris'])

    const raw = collectExportData(table, {
      formatValue: ({ value }) => value,
    })
    expect(raw.rows[0]).toEqual(['lead', ['vip', 'partner'], 'm1', 'Rome'])
  })
})
