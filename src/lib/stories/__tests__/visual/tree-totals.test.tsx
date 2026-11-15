/**
 * Итог дерева по всем узлам и итог от приложения настоящим рендером (ADR 0229; AG3, AG8, AG11):
 * набор в поле поиска, смена аргумента `totals` и колонок серверной модели на лету.
 */
import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnTotals,
  quickSearch,
  rowExpanding,
  serverRowModel,
} from '../../../plugins'

interface Item {
  id: string
  name: string
  amount: number
  subRows?: Item[]
}

/** У отдела свои продажи, у людей — свои. */
const TREE: Item[] = [
  {
    id: 'north',
    name: 'North',
    amount: 1000,
    subRows: [
      { id: 'anna', name: 'Anna', amount: 100 },
      { id: 'boris', name: 'Boris', amount: 200 },
    ],
  },
  {
    id: 'south',
    name: 'South',
    amount: 2000,
    subRows: [{ id: 'clara', name: 'Clara', amount: 700 }],
  },
]

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    dataType: 'number',
    aggregationFn: 'sum',
    aggregationScope: 'all',
    enableGlobalFilter: false,
  },
]

const footerOf = (id: string) =>
  document
    .querySelector(`.data-grid__footer-cell[data-column-id="${id}"]`)
    ?.textContent?.trim() ?? null

describe('итог дерева по всем узлам (ADR 0229)', () => {
  test("AG3: поиск в поле поиска — родитель, оставшийся предком найденной строки, входит в итог колонки 'all'", async () => {
    const Grid = () => {
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: TREE,
        getRowId: (row: Item) => row.id,
        getSubRows: (row: Item) => row.subRows,
        locale: 'en-US',
        plugins: [
          columnTotals(),
          rowExpanding(),
          quickSearch({ debounceMs: 0 }),
        ],
      } as never)
      return (
        <div style={{ width: 600, height: 320 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const screen = await render(<Grid />)
    await expect.poll(() => footerOf('amount')).toBe('4000')
    await expect
      .poll(() => document.querySelector('[data-testid="quick-search"]'))
      .not.toBeNull()
    await userEvent.fill(
      document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')!,
      'Anna',
    )
    // North остаётся предком Anna и входит в итог: 1000 + 100.
    await expect.poll(() => footerOf('amount')).toBe('1100')
    await screen.unmount()
  })

  test('AG8: новое значение аргумента totals на лету перерисовывает ячейку футера, число — текстом по типу колонки', async () => {
    let setTotal!: (value: number | undefined) => void
    const Grid = () => {
      const [total, set] = useState<number | undefined>(48_000)
      setTotal = set
      const table = useCreateTable({
        columns: COLUMNS as never,
        data: TREE,
        getRowId: (row: Item) => row.id,
        getSubRows: (row: Item) => row.subRows,
        locale: 'en-US',
        plugins: [
          columnTotals({
            totals: total === undefined ? undefined : { amount: total },
          }),
          rowExpanding({
            hasChildren: (row: Item) => !!row.subRows,
            loadChildren: (row: Item) => row.subRows ?? [],
          } as never),
        ],
      } as never)
      return (
        <div style={{ width: 600, height: 320 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const screen = await render(<Grid />)
    await expect.poll(() => footerOf('amount')).toBe('48000')
    setTotal(52_500)
    await expect.poll(() => footerOf('amount')).toBe('52500')
    // Без итога приложения ленивое дерево по всем узлам итога не даёт.
    setTotal(undefined)
    await expect.poll(() => footerOf('amount')).toBe('')
    await screen.unmount()
  })

  test('AG11: в серверной модели новые колонки со сменой режима агрегата — новая выборка с новым режимом в запросе и новый итог; новые колонки с теми же агрегатами выборку не начинают', async () => {
    const requests: Record<string, unknown>[] = []
    const getRows = (request: {
      start: number
      end: number
      parentId?: string
      aggregationScopes: Record<string, 'all'>
    }) => {
      requests.push(request)
      const all = request.aggregationScopes.amount === 'all'
      return Promise.resolve({
        rows: request.parentId ? [] : TREE.map(({ subRows: _, ...row }) => row),
        rowCount: request.parentId ? 0 : TREE.length,
        totals: { amount: all ? 4000 : 3000 },
      })
    }
    const columnsOf = (scope: 'top' | 'all') =>
      COLUMNS.map(column =>
        column.id === 'amount'
          ? { ...column, aggregationScope: scope }
          : column,
      )
    let setColumns!: (columns: object[]) => void
    const Grid = () => {
      const [columns, set] = useState<object[]>(() => columnsOf('top'))
      setColumns = set
      const table = useCreateTable({
        columns: columns as never,
        data: [],
        getRowId: (row: Item) => row.id,
        locale: 'en-US',
        plugins: [columnTotals(), serverRowModel({ getRows } as never)],
      } as never)
      return (
        <div style={{ width: 600, height: 320 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    const screen = await render(<Grid />)
    await expect.poll(() => footerOf('amount')).toBe('3000')

    setColumns(columnsOf('all'))
    await expect.poll(() => footerOf('amount')).toBe('4000')
    expect(requests.at(-1)!.aggregationScopes).toEqual({ amount: 'all' })

    const before = requests.length
    setColumns(columnsOf('all'))
    // Два кадра: эффект новых колонок успел бы запросить.
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    expect(requests).toHaveLength(before)
    await screen.unmount()
  })
})
