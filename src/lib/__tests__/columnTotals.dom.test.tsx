// @vitest-environment happy-dom
/**
 * Итоги колонок на таблице (ADR 0184; CT1, CT4–CT9).
 * Запуск: npx vitest run --config vitest.node.config.ts columnTotals
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  columnFilteringModel,
  columnTotals,
  infiniteScroll,
  pagination,
  quickSearchModel,
  rowExpanding,
  rowGroupingModel,
  serverRowModel,
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

const ROWS: Item[] = [
  { id: 'r1', city: 'Paris', amount: 1 },
  { id: 'r2', city: 'Rome', amount: 2 },
  { id: 'r3', city: 'Paris', amount: 4 },
  { id: 'r4', city: 'Rome', amount: 8 },
]
const SUM = 15
const COLUMNS = [
  { id: 'city', accessorKey: 'city', enableGlobalFilter: true },
  { id: 'amount', accessorKey: 'amount', aggregationFn: 'sum' },
]
const NO_ROWS: Item[] = []

let root: Root
let table: any

const Grid = (params: Record<string, unknown>) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: ROWS,
    getRowId: (row: Item) => row.id,
    ...params,
  } as never)
  return null
}

const mount = (params: Record<string, unknown>) =>
  act(() => root.render(<Grid {...params} />))
const total = () => table.getColumnTotal('amount')
const diagnosis = (id: string) =>
  table
    .getPluginDiagnostics()
    .find((item: { id: string }) => item.id === id) as
    { status: string; reason?: string } | undefined

beforeEach(() => {
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('итоги колонок (ADR 0184)', () => {
  const warnings = captureInertWarnings()

  it('CT1: columnTotals() включает футер; enableFooter: false его запрещает, плагин инертен с причиной', () => {
    mount({ plugins: [columnTotals()] })
    expect(table.options.enableFooter).toBe(true)
    expect(diagnosis('columnTotals')?.status).toBe('active')
    expect(total()).toBe(SUM)

    mount({ plugins: [columnTotals()], enableFooter: false })
    expect(table.options.enableFooter).toBe(false)
    expect(diagnosis('columnTotals')).toMatchObject({
      status: 'inert',
      reason: 'noFooter',
    })

    mount({ plugins: [columnTotals({ enabled: false })] })
    expect(table.options.enableFooter).toBeUndefined()
    expect(total()).toBeUndefined()
  })

  it('CT4: итог — по строкам после фильтров и поиска на всех страницах: страница и группировка его не меняют, фильтр и смена data меняют', () => {
    const plugins = [
      columnTotals(),
      pagination({ initialPageSize: 2 }),
      columnFilteringModel(),
      quickSearchModel(),
      rowGroupingModel(),
    ]
    mount({ plugins })
    expect(total()).toBe(SUM)

    act(() => table.setPageIndex(1))
    expect(total()).toBe(SUM)
    act(() => table.setPageIndex(0))

    act(() => table.setGrouping(['city']))
    expect(total()).toBe(SUM)
    act(() => table.setGrouping([]))

    act(() =>
      table.setColumnFilters([
        { id: 'city', value: { operator: 'contains', value: 'Par' } },
      ]),
    )
    expect(total()).toBe(5)
    act(() => table.setColumnFilters([]))

    act(() => table.setGlobalFilter('Rome'))
    expect(total()).toBe(10)
    act(() => table.setGlobalFilter(''))
    expect(total()).toBe(SUM)

    mount({ plugins, data: ROWS.slice(0, 2) })
    expect(total()).toBe(3)
  })

  it('CT5: в дереве итог — по верхнему уровню, maxAggregationDepth колонки идёт глубже', () => {
    const tree: Item[] = [
      {
        id: 'p',
        city: 'Paris',
        amount: 100,
        subRows: [
          { id: 'c1', city: 'Paris', amount: 1 },
          { id: 'c2', city: 'Paris', amount: 2 },
        ],
      },
      { id: 'q', city: 'Rome', amount: 10 },
    ]
    const tracked = {
      data: tree,
      getSubRows: (row: Item) => row.subRows,
      plugins: [columnTotals(), rowExpanding()],
    }
    mount(tracked)
    expect(total()).toBe(110)

    mount({
      ...tracked,
      columns: [{ ...COLUMNS[1], maxAggregationDepth: 1 }],
    })
    expect(total()).toBe(13)
  })

  it('CT6: итог считается по данным — черновики его не меняют', () => {
    mount({ plugins: [columnTotals(), cellEditing({ saveMode: 'manual' })] })
    act(() =>
      table.setDraft({
        kind: 'cellValue',
        target: { cell: ['r1', 'amount'] },
        value: { value: 1000, text: '1000' },
      }),
    )
    expect(table.getDrafts()).toHaveLength(1)
    expect(total()).toBe(SUM)
  })

  it('CT7: страница с сервера и лента — итога нет, getColumnTotal даёт undefined, в разработке предупреждение', () => {
    mount({
      dataMode: { pagination: 'server' },
      rowCount: 100,
      plugins: [columnTotals(), pagination({ initialPageSize: 4 })],
    })
    expect(total()).toBeUndefined()
    expect(diagnosis('columnTotals')).toMatchObject({
      status: 'inert',
      reason: 'partialRows',
    })

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    mount({
      rowCount: 100,
      plugins: [
        columnTotals(),
        infiniteScroll({ onLoadMore: () => {}, hasMore: true }),
      ],
    })
    expect(total()).toBeUndefined()
    expect(diagnosis('columnTotals')?.reason).toBe('partialRows')
    expect(warnings().some(text => text.includes('columnTotals инертен'))).toBe(
      true,
    )
  })

  it('CT8: в серверной модели строк плагин ничего не считает — футер и getColumnTotal берут totals ответа', async () => {
    const getRows = ({ start, end }: { start: number; end: number }) =>
      Promise.resolve({
        rows: ROWS.slice(start, end),
        rowCount: ROWS.length,
        totals: { amount: 999 },
      })
    mount({
      data: NO_ROWS,
      plugins: [columnTotals(), serverRowModel({ getRows } as never)],
    })
    expect(table.options.enableFooter).toBe(true)
    expect(diagnosis('columnTotals')?.status).toBe('active')
    expect(total()).toBeUndefined()

    await act(async () => {
      table.getRowSource().observe({ first: 0, last: 3, fast: false })
      await Promise.resolve()
    })
    expect(total()).toBe(999)
    expect(table.getColumnTotal('city')).toBeUndefined()
  })

  it('CT9: без плагина футер работает как раньше: своё содержимое footer, в SSRM — totals ответа', async () => {
    mount({ enableFooter: true })
    expect(table.options.enableFooter).toBe(true)
    expect(total()).toBeUndefined()

    mount({})
    expect(table.options.enableFooter).toBeUndefined()

    const getRows = () =>
      Promise.resolve({ rows: ROWS, rowCount: 4, totals: { amount: 7 } })
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    mount({
      data: NO_ROWS,
      enableFooter: true,
      plugins: [serverRowModel({ getRows } as never)],
    })
    await act(async () => {
      table.getRowSource().observe({ first: 0, last: 3, fast: false })
      await Promise.resolve()
    })
    expect(total()).toBe(7)
  })
})
