/**
 * Headless-проверки фильтрации (ADR 0045): условия фильтров колонок, быстрый поиск,
 * объединение через И, фильтр скрытой колонки.
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { constructTable } from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { describe, expect, it } from 'vitest'

import { injectServiceColumns } from '../core/createColumns'
import { resolveHooks } from '../core/createHooks'
import { buildTesseraFeatures, foldEntries, foldHooks } from '../core/features'
import { ENGLISH_LABELS } from '../core/localization'
import { dataExport } from '../plugins/dataExport'
import { exportRowsOf } from '../plugins/dataExportModel/exportData'
import { rowLabel } from '../plugins/dataExport/rowLabel'
import { resolveAxes } from '../plugins/dataExportModel/settings'
import { columnFiltering } from '../plugins/columnFiltering'
import type { ColumnFilterValue } from '../plugins/columnFiltering'
import { columnVisibility } from '../plugins/columnVisibility'
import { quickSearch } from '../plugins/quickSearch'
import { rowSelection } from '../plugins/rowSelection'

interface Item {
  id: string
  name: string | null | undefined
  city: string
  age: number | null
}

const DATA: Item[] = [
  { id: '1', name: 'Alice', city: 'Paris', age: 30 },
  { id: '2', name: 'bob', city: 'Berlin', age: 25 },
  { id: '3', name: 'Alina', city: 'Rome', age: null },
  { id: '4', name: '', city: 'Oslo', age: 41 },
  { id: '5', name: null, city: 'Lima', age: 30 },
  { id: '6', name: undefined, city: 'Bern', age: 18 },
]

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'city', accessorKey: 'city', header: 'City', filter: 'text' },
  { id: 'age', accessorKey: 'age', header: 'Age', filter: 'number' },
]

const build = (plugins: any[] = [columnFiltering(), quickSearch()]) => {
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
    hooks: resolveHooks(foldHooks(entries)),
    pluginDiagnostics: folded.pluginDiagnostics,
    logLevel: 'error',
  } as never) as any
}

const ids = (table: any): string[] =>
  table.getRowModel().rows.map((row: { id: string }) => row.id)

/** Строки, прошедшие один фильтр колонки. */
const filtered = (columnId: string, filter: ColumnFilterValue) => {
  const table = build()
  table.setColumnFilters([{ id: columnId, value: filter }])
  return ids(table)
}

describe('columnFiltering — условия', () => {
  it('FL4: текст «содержит», «равно», «начинается с», «заканчивается на» — без учёта регистра, ввод обрезан по краям; пустой ввод — фильтра нет', () => {
    expect(filtered('name', { operator: 'contains', value: ' LI ' })).toEqual([
      '1',
      '3',
    ])
    expect(filtered('name', { operator: 'equals', value: 'BOB' })).toEqual([
      '2',
    ])
    expect(filtered('name', { operator: 'startsWith', value: 'al' })).toEqual([
      '1',
      '3',
    ])
    expect(filtered('name', { operator: 'endsWith', value: 'NA ' })).toEqual([
      '3',
    ])

    const table = build()
    table
      .getColumn('name')
      .setFilterValue({ operator: 'contains', value: '  ' })
    expect(table.atoms.columnFilters.get()).toEqual([])
    expect(ids(table)).toHaveLength(DATA.length)
  })

  it('FL5: текст «пусто» — null, undefined и пустая строка; «не пусто» — остальное', () => {
    expect(filtered('name', { operator: 'empty' })).toEqual(['4', '5', '6'])
    expect(filtered('name', { operator: 'notEmpty' })).toEqual(['1', '2', '3'])
  })

  it('FL6: число — сравнения, «между» с границами включительно и открытой границей, «пусто» и «не пусто»', () => {
    expect(filtered('age', { operator: 'equals', value: 30 })).toEqual([
      '1',
      '5',
    ])
    expect(filtered('age', { operator: 'notEquals', value: 30 })).toEqual([
      '2',
      '4',
      '6',
    ])
    expect(filtered('age', { operator: 'lessThan', value: 25 })).toEqual(['6'])
    expect(filtered('age', { operator: 'lessThanOrEqual', value: 25 })).toEqual(
      ['2', '6'],
    )
    expect(filtered('age', { operator: 'greaterThan', value: 30 })).toEqual([
      '4',
    ])
    expect(
      filtered('age', { operator: 'greaterThanOrEqual', value: 30 }),
    ).toEqual(['1', '4', '5'])
    expect(filtered('age', { operator: 'between', value: [25, 30] })).toEqual([
      '1',
      '2',
      '5',
    ])
    expect(filtered('age', { operator: 'between', value: [null, 25] })).toEqual(
      ['2', '6'],
    )
    expect(filtered('age', { operator: 'between', value: [31, null] })).toEqual(
      ['4'],
    )
    expect(filtered('age', { operator: 'empty' })).toEqual(['3'])
    expect(filtered('age', { operator: 'notEmpty' })).toEqual([
      '1',
      '2',
      '4',
      '5',
      '6',
    ])
  })
})

describe('columnFiltering и quickSearch — сочетание', () => {
  it('FL2: фильтры разных колонок и быстрый поиск объединяются через И', () => {
    const table = build()
    table.setColumnFilters([
      { id: 'age', value: { operator: 'greaterThanOrEqual', value: 25 } },
    ])
    expect(ids(table)).toEqual(['1', '2', '4', '5'])
    table.setColumnFilters([
      { id: 'age', value: { operator: 'greaterThanOrEqual', value: 25 } },
      { id: 'city', value: { operator: 'startsWith', value: 'b' } },
    ])
    expect(ids(table)).toEqual(['2'])
    table.setColumnFilters([
      { id: 'age', value: { operator: 'greaterThanOrEqual', value: 25 } },
    ])
    table.setGlobalFilter('li')
    expect(ids(table)).toEqual(['1', '2', '5'])
  })

  it('FL26: скрытие колонки не снимает её фильтр', () => {
    const table = build([columnFiltering(), columnVisibility()])
    const filter = { id: 'city', value: { operator: 'equals', value: 'rome' } }
    table.setColumnFilters([filter])
    expect(ids(table)).toEqual(['3'])
    table.getColumn('city').toggleVisibility(false)
    expect(table.getColumn('city').getIsVisible()).toBe(false)
    expect(table.atoms.columnFilters.get()).toEqual([filter])
    expect(ids(table)).toEqual(['3'])
    // Новый фильтр пересобирает модель: фильтр скрытой колонки всё ещё действует.
    table.getColumn('name').setFilterValue({ operator: 'notEmpty' })
    expect(ids(table)).toEqual(['3'])
  })
})

describe('quickSearch', () => {
  it('FL14: поиск «содержит» без учёта регистра по видимым колонкам со строкой или числом; enableGlobalFilter: false и служебные колонки не участвуют', () => {
    const table = build([quickSearch(), columnVisibility(), rowSelection()])
    table.setGlobalFilter(' BER ')
    expect(ids(table)).toEqual(['2', '6'])
    table.setGlobalFilter('41')
    expect(ids(table)).toEqual(['4'])

    table.setGlobalFilter('rome')
    expect(ids(table)).toEqual(['3'])
    table.getColumn('city').toggleVisibility(false)
    expect(ids(table)).toEqual([])

    const service = table
      .getAllLeafColumns()
      .filter((column: any) => column.getIsActionsColumn())
    expect(service.length).toBeGreaterThan(0)
    for (const column of service) {
      expect(column.getCanGlobalFilter()).toBe(false)
    }

    const excluded = build([quickSearch()])
    excluded.getColumn('name').columnDef.enableGlobalFilter = false
    excluded.setGlobalFilter('alice')
    expect(ids(excluded)).toEqual([])
  })
})

describe('фильтрация при запрещённом тулбаре', () => {
  it('FL18: при enableToolbar: false фильтры колонок работают, плагин активен в diagnose', () => {
    const entry = columnFiltering() as any
    const table = build([entry])
    table.options.enableToolbar = false
    expect(entry.diagnose(table)).toBeUndefined()
    table.setColumnFilters([
      { id: 'city', value: { operator: 'equals', value: 'oslo' } },
    ])
    expect(ids(table)).toEqual(['4'])
  })

  it('PB9: при enableToolbar: false quickSearch активен в diagnose, а программная смена globalFilter фильтрует строки', () => {
    const entry = quickSearch() as any
    const table = build([entry])
    table.options.enableToolbar = false
    expect(entry.diagnose(table)).toBeUndefined()
    table.setGlobalFilter('ber')
    expect(ids(table)).toEqual(['2', '6'])
  })
})

describe('фильтрация и экспорт', () => {
  it('FL25: экспорт view учитывает фильтры и поиск, подпись exportView называет фильтрацию; selected выгружает и выбранные строки, скрытые фильтром', () => {
    const table = build([
      columnFiltering(),
      quickSearch(),
      dataExport(),
      rowSelection(),
    ])
    const axes = resolveAxes(table)!
    expect(axes.rows.map(row => row.value)).toContain('view')
    expect(axes.viewBy).toEqual(['filtering'])
    expect(rowLabel(ENGLISH_LABELS, 'view', axes.viewBy)).toBe('With filters')

    const exported = (scope: 'view' | 'selected') =>
      exportRowsOf(table, scope).map(row => row.id)
    table.setColumnFilters([
      { id: 'city', value: { operator: 'startsWith', value: 'b' } },
    ])
    expect(exported('view')).toEqual(['2', '6'])
    table.setGlobalFilter('bob')
    expect(exported('view')).toEqual(['2'])
    table.setGlobalFilter(undefined)

    table.setRowSelection({ '1': true, '2': true })
    // Видимые — в порядке вида, скрытые фильтром — после них, в порядке данных.
    expect(exported('selected')).toEqual(['2', '1'])
  })
})

describe('серверный режим без колбэка', () => {
  it('FL31: серверный режим без колбэка — diagnose → noOnFilterChange / noOnSearchChange', () => {
    const filtering = columnFiltering({ server: true }) as any
    const search = quickSearch({ server: true }) as any
    const table = build([filtering, search])
    expect(filtering.diagnose(table)).toBe('noOnFilterChange')
    expect(search.diagnose(table)).toBe('noOnSearchChange')

    const withCallbacks = build([
      columnFiltering({ server: true, onFilterChange: () => {} }),
      quickSearch({ server: true, onSearchChange: () => {} }),
    ])
    expect(filtering.diagnose(withCallbacks)).toBeUndefined()
    expect(search.diagnose(withCallbacks)).toBeUndefined()
  })
})
