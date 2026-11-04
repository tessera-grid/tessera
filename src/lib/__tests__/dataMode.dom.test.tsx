// @vitest-environment happy-dom
/**
 * Режим данных таблицы (ADR 0169; MD1, MD2, MD4–MD6, MD8–MD10): `dataMode` по операциям,
 * `manual*` от ядра, фильтры колонок и поиск по отдельности, серверная модель строк,
 * предупреждение о клиентской операции над частью строк, итог строк таблицы и факт
 * «строки страницами».
 * Запуск: npx vitest run --config vitest.node.config.ts
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DATA_OPERATIONS,
  type DataMode,
  dataModeOf,
  isPaginationActive,
} from '../core/dataMode'
import { foldEntries, type TesseraFeatureEntry } from '../core/features'
import { expandIncludedModels } from '../core/pluginModels'
import { ENGLISH_LABELS } from '../core/localization'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFiltering,
  columnFilteringModel,
  columnSorting,
  infiniteScroll,
  pagination,
  quickSearch,
  quickSearchModel,
  rowGrouping,
  serverRowModel,
} from '../plugins'
import { FOREIGN_OPTION_READS } from './architecture.baseline'
import { builtinPluginEntries, pluginFactories } from './builtinPlugins'
import { FilteredRowsCount } from '../shared/filtering/FilteredRowsCount'
import { captureInertWarnings } from './inertWarnings'
import { filteringLabels } from '../shared/filtering/labels'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  city: string
}

const DATA: Item[] = [
  { id: '1', name: 'Alice', city: 'Paris' },
  { id: '2', name: 'Bob', city: 'Oslo' },
  { id: '3', name: 'Alina', city: 'Oslo' },
  { id: '4', name: 'Carl', city: 'Paris' },
]

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]

let root: Root | undefined
let table: any

interface Counts {
  rowCount?: number
  totalRowCount?: number
}

const Host = ({
  plugins,
  dataMode,
  counts,
}: {
  plugins: readonly unknown[]
  dataMode?: DataMode
  counts?: Counts
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    dataMode,
    ...counts,
    plugins: plugins as never,
  })
  return null
}

const render = (
  plugins: readonly unknown[],
  dataMode?: DataMode,
  counts?: Counts,
) => {
  root ??= createRoot(document.createElement('div'))
  act(() => root!.render(createElement(Host, { plugins, dataMode, counts })))
  return table
}

/** Новая таблица: режим и набор плагинов — договор на время жизни. */
const mount = (
  plugins: readonly unknown[],
  dataMode?: DataMode,
  counts?: Counts,
) => {
  act(() => root?.unmount())
  root = undefined
  return render(plugins, dataMode, counts)
}

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const rowIds = () =>
  (table.getRowModel().rows as { id: string }[]).map(row => row.id)

const modes = () =>
  Object.fromEntries(
    DATA_OPERATIONS.map(operation => [operation, dataModeOf(table, operation)]),
  )

const onServer = (...operations: string[]) =>
  Object.fromEntries(
    DATA_OPERATIONS.map(operation => [
      operation,
      operations.includes(operation) ? 'server' : 'client',
    ]),
  )

describe('режим данных (ADR 0169)', () => {
  const warnings = captureInertWarnings()
  const modeWarnings = (part: string) =>
    warnings().filter(
      text => text.includes(`dataMode: `) && text.includes(part),
    )

  it("MD1: useCreateTable({ dataMode }) — 'client', 'server' или объект по операциям; не заданная операция — на клиенте; значение берётся при монтировании, смена на лету — dev-warn", () => {
    mount([columnSorting()])
    expect(modes()).toEqual(onServer())
    mount([columnSorting()], 'client')
    expect(modes()).toEqual(onServer())
    mount([columnSorting()], 'server')
    expect(modes()).toEqual(onServer(...DATA_OPERATIONS))
    mount([columnSorting()], { sorting: 'server', export: 'server' })
    expect(modes()).toEqual(onServer('sorting', 'export'))
    expect(warnings().filter(text => text.includes('dataMode'))).toEqual([])

    // Смена после монтирования: режим прежний, одно предупреждение о договоре.
    render([columnSorting()], 'server')
    render([columnSorting()], { filtering: 'server' })
    expect(modes()).toEqual(onServer('sorting', 'export'))
    expect(table.options.manualSorting).toBe(true)
    expect(table.options.manualFiltering).toBe(false)
    const lifetime = warnings().filter(text =>
      text.includes('dataMode — договор на время жизни'),
    )
    expect(lifetime).toHaveLength(1)
  })

  it("MD2: manualSorting, manualFiltering и manualPagination выставляет ядро по dataMode; при filtering: 'server', search: 'client' клиент применяет только поиск, при filtering: 'client', search: 'server' — только фильтры колонок", () => {
    const plugins = [
      columnSorting(),
      columnFiltering(),
      quickSearch(),
      pagination(),
    ]
    const manual = () => ({
      manualSorting: table.options.manualSorting,
      manualFiltering: table.options.manualFiltering,
      manualPagination: table.options.manualPagination,
    })
    mount(plugins)
    expect(manual()).toEqual({
      manualSorting: false,
      manualFiltering: false,
      manualPagination: false,
    })
    mount(plugins, 'server')
    expect(manual()).toEqual({
      manualSorting: true,
      manualFiltering: true,
      manualPagination: true,
    })
    mount(plugins, { sorting: 'server', pagination: 'server' })
    expect(manual()).toEqual({
      manualSorting: true,
      manualFiltering: false,
      manualPagination: true,
    })

    const narrow = () => {
      act(() =>
        table.setColumnFilters([
          { id: 'city', value: { operator: 'contains', value: 'Paris' } },
        ]),
      )
      act(() => table.setGlobalFilter('Ali'))
    }
    mount([columnFilteringModel(), quickSearchModel()])
    narrow()
    expect(rowIds()).toEqual(['1'])

    mount([columnFilteringModel(), quickSearchModel()], {
      filtering: 'server',
      search: 'client',
    })
    expect(table.options.manualFiltering).toBe(false)
    narrow()
    expect(rowIds()).toEqual(['1', '3'])

    mount([columnFilteringModel(), quickSearchModel()], {
      filtering: 'client',
      search: 'server',
    })
    narrow()
    expect(rowIds()).toEqual(['1', '4'])
  })

  it('MD4: serverRowModel — сервер для всех операций, кроме выгрузки; dataMode, который ему противоречит, — dev-warn', () => {
    const rows = serverRowModel({ getRows: () => new Promise(() => {}) })
    mount([rows, columnSorting()])
    expect(modes()).toEqual(
      onServer('sorting', 'filtering', 'search', 'pagination'),
    )
    mount([rows, columnSorting()], { export: 'server' })
    expect(modes()).toEqual(onServer(...DATA_OPERATIONS))
    mount([rows, columnSorting()], 'server')
    expect(modeWarnings('server row model')).toEqual([])

    mount([rows, columnSorting()], { sorting: 'client', search: 'client' })
    expect(dataModeOf(table, 'sorting')).toBe('server')
    const contradictions = modeWarnings('server row model')
    expect(contradictions).toHaveLength(1)
    expect(contradictions[0]).toContain('sorting, search')
  })

  it('MD5: часть строк в data (серверная страница, серверная модель, лента) и операция с непустым срезом на клиенте — одно dev-предупреждение на операцию с причиной; лента не читает чужих enable*', () => {
    // Лента с клиентскими сортировкой и группировкой: пустые срезы — без предупреждений.
    mount([columnSorting(), rowGrouping(), infiniteScroll({ hasMore: true })])
    expect(modeWarnings('only sees loaded rows')).toEqual([])
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    act(() => table.setSorting([{ id: 'city', desc: false }]))
    act(() => table.setGrouping(['city']))
    expect(modeWarnings('only sees loaded rows')).toEqual([
      expect.stringContaining(
        'client-side sorting only sees loaded rows (feed)',
      ),
      expect.stringContaining(
        'client-side grouping only sees loaded rows (feed)',
      ),
    ])

    // Сортировка на сервере — без предупреждения.
    mount([columnSorting(), infiniteScroll({ hasMore: true })], {
      sorting: 'server',
    })
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    expect(modeWarnings('only sees loaded rows')).toHaveLength(2)

    // Страницы с сервера и поиск на клиенте.
    mount([quickSearch(), pagination()], {
      pagination: 'server',
    })
    act(() => table.setGlobalFilter('Ali'))
    expect(modeWarnings('only sees loaded rows').at(-1)).toContain(
      'client-side search only sees loaded rows (serverPage)',
    )

    // Все строки в data — без предупреждений.
    const before = modeWarnings('only sees loaded rows').length
    mount([columnSorting(), quickSearch()])
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    act(() => table.setGlobalFilter('Ali'))
    expect(modeWarnings('only sees loaded rows')).toHaveLength(before)

    // Лента сама чужих флагов не читает: её предупреждений о клиентской обработке нет.
    expect(warnings().some(text => text.startsWith('infiniteScroll:'))).toBe(
      false,
    )
  })

  it('MD8: «строки режутся на страницы» — факт ядра от модели пагинации; ядро, лента и модель раскрытия не читают paginateExpandedRows', () => {
    const feedStatus = () =>
      table
        .getPluginDiagnostics()
        .find((d: { id: string }) => d.id === 'infiniteScroll')
    mount([pagination({ initialPageSize: 2 }), infiniteScroll()])
    expect(isPaginationActive(table)).toBe(true)
    expect(rowIds()).toEqual(['1', '2'])
    expect(feedStatus()).toMatchObject({
      status: 'inert',
      reason: 'pagination',
    })

    mount([
      pagination({ enabled: false, initialPageSize: 2 }),
      infiniteScroll(),
    ])
    expect(isPaginationActive(table)).toBe(false)
    expect(rowIds()).toEqual(['1', '2', '3', '4'])
    expect(feedStatus()).toMatchObject({ status: 'active' })

    // Стоковая опция без модели пагинации факта не создаёт.
    const stock: TesseraFeatureEntry = {
      id: 'stockOption',
      options: { paginateExpandedRows: false },
    }
    mount([stock, infiniteScroll()])
    expect(isPaginationActive(table)).toBe(false)
    expect(feedStatus()).toMatchObject({ status: 'active' })
  })

  it('MD9: плагины не выставляют manual*, у предупреждения о перезаписи опций нет исключения для manualFiltering; в базе LB5 нет чтений режима операций', () => {
    const MANUAL = ['manualSorting', 'manualFiltering', 'manualPagination']
    const folded = (entries: readonly TesseraFeatureEntry[]) =>
      Object.keys(foldEntries(expandIncludedModels(entries).entries).options)
    for (const [name, factory] of pluginFactories()) {
      for (const args of [{}, { enabled: false }]) {
        const keys = folded([factory(args) as TesseraFeatureEntry])
        expect(
          keys.filter(key => MANUAL.includes(key)),
          name,
        ).toEqual([])
      }
    }
    expect(
      folded(builtinPluginEntries() as TesseraFeatureEntry[]).filter(key =>
        MANUAL.includes(key),
      ),
    ).toEqual([])

    // Фильтры колонок и поиск делят только filterFromLeafRows.
    const filterKeys = folded([columnFilteringModel()])
    const searchKeys = folded([quickSearchModel()])
    expect(filterKeys.filter(key => searchKeys.includes(key))).toEqual([
      'filterFromLeafRows',
    ])

    const MODE_KEYS =
      /: (manual\w+|paginateExpandedRows|\w+Server|enableSorting|enableColumnFilters|enableGlobalFilter)$/
    expect(
      Object.keys(FOREIGN_OPTION_READS).filter(key => MODE_KEYS.test(key)),
    ).toEqual([])
  })

  it('MD6: rowCount (-1 — неизвестно) и totalRowCount в useCreateTable: пейджер, серверная модель, лента, aria-rowcount и «показано N из M» читают их через ядро; аргументов rowCount, filteredRowCount и totalRowCount у плагинов нет', () => {
    // Пейджер: страницы с сервера — по итогу таблицы, клиентские — по строкам data.
    mount(
      [pagination({ initialPageSize: 2 })],
      { pagination: 'server' },
      {
        rowCount: 60,
      },
    )
    expect(table.getPageCount()).toBe(30)
    mount(
      [pagination({ initialPageSize: 2 })],
      { pagination: 'server' },
      {
        rowCount: -1,
      },
    )
    expect(
      table
        .getPluginDiagnostics()
        .find((d: { id: string }) => d.id === 'pagination'),
    ).toMatchObject({ status: 'inert', reason: 'noRowCount' })
    mount([pagination({ initialPageSize: 2 })], undefined, { rowCount: 60 })
    expect(table.getPageCount()).toBe(2)

    // Серверная модель строк: итог до первого ответа.
    mount(
      [serverRowModel({ getRows: () => new Promise(() => {}) })],
      undefined,
      { rowCount: 500 },
    )
    expect(table.getRowSource().count()).toBe(500)

    // Лента: aria-rowcount — итог таблицы, -1 — неизвестен.
    const ariaRowCount = (rowCount?: number) =>
      mount([infiniteScroll({ hasMore: true })], undefined, {
        rowCount,
      }).options.getTotalRowCount(table)
    expect([ariaRowCount(100), ariaRowCount(-1), ariaRowCount()]).toEqual([
      100, -1, -1,
    ])

    // «Показано N из M» при фильтрах на сервере.
    const shown = (
      counts: Counts,
      dataMode: DataMode = 'server',
      searchText = 'Ali',
    ) => {
      mount(
        [columnFiltering({ filteredCount: true }), quickSearchModel()],
        dataMode,
        counts,
      )
      act(() =>
        table.setColumnFilters([
          { id: 'city', value: { operator: 'contains', value: 'Paris' } },
        ]),
      )
      act(() => table.setGlobalFilter(searchText))
      const node = document.createElement('div')
      const counter = createRoot(node)
      flushSync(() =>
        counter.render(createElement(FilteredRowsCount, { table } as never)),
      )
      const text = node.textContent
      counter.unmount()
      return text
    }
    expect(shown({ rowCount: 3, totalRowCount: 40 })).toBe(
      filteringLabels(ENGLISH_LABELS).filteredRows(3, 40),
    )
    expect(shown({ rowCount: 3 })).toBe('')
    // Фильтры на сервере, клиент ответ не сужает: N — итог сервера.
    expect(
      shown({ rowCount: 4, totalRowCount: 40 }, { filtering: 'server' }, ''),
    ).toBe(filteringLabels(ENGLISH_LABELS).filteredRows(4, 40))
    // Фильтры на сервере, поиск на клиенте: N — строки ответа после поиска.
    expect(
      shown({ rowCount: 4, totalRowCount: 40 }, { filtering: 'server' }),
    ).toBe(filteringLabels(ENGLISH_LABELS).filteredRows(2, 40))

    // Аргументы итога у фабрик ничего не меняют.
    const optionsOf = (entry: TesseraFeatureEntry) =>
      JSON.stringify(foldEntries(expandIncludedModels([entry]).entries).options)
    for (const [name, factory] of pluginFactories()) {
      expect(
        optionsOf(
          factory({
            rowCount: 7,
            filteredRowCount: 7,
            totalRowCount: 7,
          }) as TesseraFeatureEntry,
        ),
        name,
      ).toBe(optionsOf(factory({}) as TesseraFeatureEntry))
    }
  })

  it('MD10: в базе LB5 нет записей шага 6: итог строк и пояс дат читаются через ядро', () => {
    expect(
      Object.entries(FOREIGN_OPTION_READS)
        .filter(([, reason]) => reason.includes('шаг 6'))
        .map(([key]) => key),
    ).toEqual([])
  })
})
