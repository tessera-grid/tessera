// @vitest-environment happy-dom
/**
 * Итог дерева по всем узлам и итог от приложения (ADR 0229; AG1–AG2, AG4–AG7, AG9).
 * Запуск: npx vitest run --config vitest.node.config.ts aggregationScope
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import {
  columnTotals,
  dataExport,
  type ExportRequest,
  pagination,
  quickSearchModel,
  rowExpanding,
  rowGroupingModel,
  serverRowModel,
  type ServerRowsRequest,
} from '../plugins'
import { captureInertWarnings } from './inertWarnings'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  city: string
  amount: number
  subRows?: Item[]
}

/** У родителя своё значение: в «все узлы» он и потомки складываются. */
const TREE: Item[] = [
  {
    id: 'p',
    city: 'Paris',
    amount: 100,
    subRows: [
      { id: 'c1', city: 'Paris', amount: 1 },
      { id: 'c2', city: 'Rome', amount: 2 },
    ],
  },
  {
    id: 'q',
    city: 'Rome',
    amount: 10,
    subRows: [{ id: 'c3', city: 'Rome', amount: 20 }],
  },
]
const TOP = 110
const ALL = 133

const cityColumn = { id: 'city', accessorKey: 'city', enableGlobalFilter: true }
const amountColumn = (extra: Record<string, unknown> = {}) => ({
  id: 'amount',
  accessorKey: 'amount',
  aggregationFn: 'sum',
  enableGlobalFilter: false,
  ...extra,
})

let root: Root
let table: any

const Grid = (params: Record<string, unknown>) => {
  table = useCreateTable({
    columns: [cityColumn, amountColumn({ aggregationScope: 'all' })] as never,
    data: TREE,
    getRowId: (row: Item) => row.id,
    getSubRows: (row: Item) => row.subRows,
    ...params,
  } as never)
  return null
}

const mount = (params: Record<string, unknown> = {}) =>
  act(() => root.render(<Grid {...params} />))
const total = () => table.getColumnTotal('amount')
const groupValues = () =>
  Object.fromEntries(
    table
      .getRowModel()
      .rows.filter((row: { getIsGrouped: () => boolean }) => row.getIsGrouped())
      .map(
        (row: { groupingValue: string; getValue: (id: string) => unknown }) => [
          row.groupingValue,
          row.getValue('amount'),
        ],
      ),
  )

beforeEach(() => {
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('итог дерева по всем узлам (ADR 0229)', () => {
  const warnings = captureInertWarnings()

  it("AG1: колонка 'all' складывает все строки дерева после отбора, свёрнутые ветки входят, maxAggregationDepth не действует; без поля и с 'top' — прежний итог", () => {
    const plugins = [columnTotals(), rowExpanding(), quickSearchModel()]
    mount({ plugins })
    // Ветки свёрнуты: итог — по данным, а не по раскрытию.
    expect(table.getRowModel().rows).toHaveLength(2)
    expect(total()).toBe(ALL)

    // Поиск оставляет p предком c2, c1 уходит: 100 + 2 + 10 + 20.
    act(() => table.setGlobalFilter('Rome'))
    expect(total()).toBe(132)
    act(() => table.setGlobalFilter(''))

    mount({
      plugins,
      columns: [
        cityColumn,
        amountColumn({ aggregationScope: 'all', maxAggregationDepth: 1 }),
      ],
    })
    expect(total()).toBe(ALL)

    mount({ plugins, columns: [cityColumn, amountColumn()] })
    expect(total()).toBe(TOP)
    mount({
      plugins,
      columns: [cityColumn, amountColumn({ aggregationScope: 'top' })],
    })
    expect(total()).toBe(TOP)
  })

  it("AG2: в режиме 'all' функции набора и своя { aggregate } получают плоский список всех строк; повторное чтение без смены модели не пересчитывает", () => {
    const plugins = [columnTotals(), rowExpanding()]
    mount({
      plugins,
      columns: [
        cityColumn,
        amountColumn({ aggregationScope: 'all', aggregationFn: 'count' }),
      ],
    })
    expect(total()).toBe(5)
    mount({
      plugins,
      columns: [
        cityColumn,
        amountColumn({ aggregationScope: 'all', aggregationFn: 'mean' }),
      ],
    })
    expect(total()).toBe(ALL / 5)

    const seen: string[][] = []
    const own = {
      aggregate: ({ rows }: { rows: readonly { id: string }[] }) => {
        seen.push(rows.map(row => row.id))
        return rows.length
      },
    }
    mount({
      plugins,
      columns: [
        cityColumn,
        amountColumn({ aggregationScope: 'all', aggregationFn: own }),
      ],
    })
    expect(total()).toBe(5)
    expect(total()).toBe(5)
    expect(seen).toEqual([['p', 'c1', 'c2', 'q', 'c3']])
  })

  it('AG4: defaultColumn.aggregationScope задаёт режим всем колонкам, поле колонки главнее', () => {
    const plugins = [columnTotals(), rowExpanding()]
    mount({
      plugins,
      columns: [cityColumn, amountColumn()],
      defaultColumn: { aggregationScope: 'all' },
    })
    expect(total()).toBe(ALL)

    mount({
      plugins,
      columns: [cityColumn, amountColumn({ aggregationScope: 'top' })],
      defaultColumn: { aggregationScope: 'all' },
    })
    expect(total()).toBe(TOP)
  })

  it("AG5: при клиентской группировке поверх дерева строка-группа колонки 'all' складывает строки группы с потомками; сумма групп равна итогу", () => {
    const plugins = [columnTotals(), rowExpanding(), rowGroupingModel()]
    mount({ plugins })
    act(() => table.setGrouping(['city']))
    const values = groupValues()
    expect(values).toEqual({ Paris: 103, Rome: 30 })
    expect(values.Paris + values.Rome).toBe(total())

    mount({ plugins, columns: [cityColumn, amountColumn()] })
    act(() => table.setGrouping(['city']))
    expect(groupValues()).toEqual({ Paris: 100, Rome: 10 })
  })

  it("AG6: в таблице с loadChildren колонка 'all' не даёт итога и значений строк-групп, в разработке одно предупреждение на колонку; колонка 'top' считается", () => {
    const lazy = rowExpanding({
      hasChildren: (row: Item) => !!row.subRows,
      loadChildren: () => [],
    } as never)
    mount({ plugins: [columnTotals(), lazy, rowGroupingModel()] })
    expect(total()).toBeUndefined()
    expect(total()).toBeUndefined()
    act(() => table.setGrouping(['city']))
    expect(groupValues()).toEqual({ Paris: undefined, Rome: undefined })
    expect(
      warnings().filter(text => text.includes('columnTotals: column "amount"')),
    ).toHaveLength(1)

    mount({
      plugins: [columnTotals(), lazy, rowGroupingModel()],
      columns: [cityColumn, amountColumn()],
    })
    expect(total()).toBe(TOP)
  })

  it('AG7: аргумент totals даёт итог вместо подсчёта — в ленивом дереве, при странице с сервера и на полных данных; в серверной модели главнее totals ответа', async () => {
    const totals = { amount: 500 }
    const lazy = rowExpanding({
      hasChildren: (row: Item) => !!row.subRows,
      loadChildren: () => [],
    } as never)
    mount({ plugins: [columnTotals({ totals }), lazy] })
    expect(total()).toBe(500)

    mount({
      dataMode: { pagination: 'server' },
      rowCount: 100,
      plugins: [columnTotals({ totals }), pagination({ initialPageSize: 2 })],
    })
    expect(total()).toBe(500)
    expect(
      table
        .getPluginDiagnostics()
        .find((item: { id: string }) => item.id === 'columnTotals')?.status,
    ).toBe('active')

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    mount({ plugins: [columnTotals({ totals }), rowExpanding()] })
    expect(total()).toBe(500)
    // Колонка без значения в аргументе считается сама.
    mount({
      plugins: [columnTotals({ totals: { city: 'x' } }), rowExpanding()],
    })
    expect(total()).toBe(ALL)

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    const getRows = () =>
      Promise.resolve({ rows: TREE, rowCount: 2, totals: { amount: 999 } })
    mount({
      data: [],
      plugins: [columnTotals({ totals }), serverRowModel({ getRows } as never)],
    })
    await act(async () => {
      table.getRowSource().observe({ first: 0, last: 1, fast: false })
      await Promise.resolve()
    })
    expect(total()).toBe(999)
  })

  it("AG9: запрос getRows и запрос серверной выгрузки несут aggregationScopes колонок 'all'; без колонок 'all' — пустой объект", async () => {
    const requests: ServerRowsRequest[] = []
    const exports: ExportRequest[] = []
    const getRows = (request: ServerRowsRequest) => {
      requests.push(request)
      return Promise.resolve({ rows: TREE, rowCount: 2 })
    }
    const plugins = [
      serverRowModel({ getRows } as never),
      quickSearchModel(),
      dataExport({ onExport: request => void exports.push(request) }),
    ]
    const show = async () =>
      act(async () => {
        table.getRowSource().observe({ first: 0, last: 1, fast: false })
        await Promise.resolve()
      })
    mount({ data: [], dataMode: { export: 'server' }, plugins })
    await show()
    expect(requests.at(-1)!.aggregationScopes).toEqual({ amount: 'all' })
    await act(() => table.exportData({ rows: 'all' }))
    expect(exports[0]!.query!.aggregationScopes).toEqual({ amount: 'all' })

    const before = requests.length
    mount({
      data: [],
      dataMode: { export: 'server' },
      plugins,
      columns: [cityColumn, amountColumn()],
    })
    // Следующий запрос — новая выборка по поиску.
    await act(async () => {
      table.setGlobalFilter('Rome')
      table.getRowSource().sync()
      await Promise.resolve()
    })
    await show()
    expect(requests.length).toBeGreaterThan(before)
    expect(requests.at(-1)!.aggregationScopes).toEqual({})
  })
})
