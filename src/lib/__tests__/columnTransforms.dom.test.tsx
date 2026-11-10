// @vitest-environment happy-dom
/**
 * Преобразования скрытых колонок, этап 1 (ADR 0204; HT1–HT2): скрытие колонки не трогает её
 * сортировку, фильтр и группировку; факт ядра `columnTransforms` — что с колонкой делают
 * плагины и как это снять их путями.
 * Запуск: npx vitest run --config vitest.node.config.ts columnTransforms
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import {
  clearColumnTransforms,
  columnTransformsOf,
  transformsOfColumn,
} from '../core/columnTransforms'
import type { DataMode } from '../core/dataMode'
import type { DebugAction } from '../core/debugActions'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFiltering,
  columnSorting,
  columnVisibility,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
} from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const COLUMNS = ['a', 'b', 'c', 'd'].map(id => ({ id, accessorKey: id }))
const DATA = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  a: `a${i}`,
  b: `b${(i * 7) % 12}`,
  c: i % 3 === 0 ? 'keep' : 'drop',
  d: `d${i % 2}`,
}))

let root: Root | undefined
let table: any

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

const mount = (element: React.ReactElement) => {
  const host = document.createElement('div')
  root = createRoot(host)
  act(() => root!.render(element))
}

interface GridProps {
  dataMode?: DataMode
  plugins?: 'all' | 'none' | 'disabled'
  onDebugAction?: (report: DebugAction) => void
  onToggleColumnSort?: (...args: unknown[]) => void
  onFilterChange?: (...args: unknown[]) => void
}

/** Сортировка по `b` убыванием, фильтр по `c`, группировка по `d`. */
const Grid = ({
  dataMode,
  plugins = 'all',
  onDebugAction,
  onToggleColumnSort,
  onFilterChange,
}: GridProps) => {
  const enabled = plugins !== 'disabled'
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: { id: string }) => row.id,
    dataMode,
    onDebugAction: onDebugAction as never,
    plugins: (plugins === 'none'
      ? [columnVisibility()]
      : [
          columnSorting({
            enabled,
            initialSorting: [{ id: 'b', desc: true }],
            onToggleColumnSort: onToggleColumnSort as never,
          }),
          columnFiltering({
            enabled,
            initialColumnFilters: [{ id: 'c', value: 'keep' }],
            onFilterChange: onFilterChange as never,
          }),
          rowGrouping({ enabled, initialGrouping: ['d'] }),
          columnVisibility(),
        ]) as never,
  })
  return null
}

const slices = () => ({
  sorting: table.atoms.sorting.get(),
  columnFilters: table.atoms.columnFilters.get(),
  grouping: table.atoms.grouping.get(),
})
const rowIds = () =>
  (table.getRowModel().rows as { id: string }[]).map(row => row.id)

describe('Преобразования скрытых колонок (ADR 0204)', () => {
  it('HT1: скрытие колонки не меняет её сортировку, фильтр и группировку: срезы и модель строк до и после одни — в клиенте и SSRM', () => {
    mount(<Grid />)
    const before = { slices: slices(), rows: rowIds() }
    expect(before.slices.sorting).toEqual([{ id: 'b', desc: true }])
    expect(before.rows.length).toBeGreaterThan(0)
    act(() => table.setColumnVisibility({ b: false, c: false, d: false }))
    expect(table.getColumn('b').getIsVisible()).toBe(false)
    expect({ slices: slices(), rows: rowIds() }).toEqual(before)
    act(() => root!.unmount())

    // SSRM: скрытие не меняет выборку — запроса строк нет, сортировка та же.
    const calls: ServerRowsRequest[] = []
    const Server = () => {
      table = useCreateTable({
        rowCount: 100,
        columns: COLUMNS as never,
        data: [] as typeof DATA,
        getRowId: (row: { id: string }) => row.id,
        plugins: [
          serverRowModel({
            getRows: (request: ServerRowsRequest) => {
              calls.push(request)
              return new Promise(() => {})
            },
            blockSize: 10,
          }),
          columnSorting({ initialSorting: [{ id: 'b', desc: true }] }),
          columnVisibility(),
        ] as never,
      })
      return null
    }
    mount(<Server />)
    act(() =>
      (table.getRowSource() as RowSource).observe!({
        first: 0,
        last: 9,
        fast: false,
      }),
    )
    const requested = calls.length
    expect(requested).toBeGreaterThan(0)
    act(() => table.setColumnVisibility({ b: false }))
    expect(calls.length).toBe(requested)
    expect(table.atoms.sorting.get()).toEqual([{ id: 'b', desc: true }])
  })

  it('HT2: факт ядра columnTransforms — columnSorting, columnFiltering и rowGrouping сообщают преобразование колонки и снимают его путями пользователя: канал действий с источником, колбэки серверного режима; без плагинов и у выключенных записей фактов нет', () => {
    const actions: DebugAction[] = []
    mount(<Grid onDebugAction={report => actions.push(report)} />)
    expect(columnTransformsOf(table).map(t => t.kind)).toEqual([
      'sort',
      'filter',
      'group',
    ])
    expect(transformsOfColumn(table, 'a')).toEqual([])
    expect(transformsOfColumn(table, 'b')).toEqual([
      { kind: 'sort', direction: 'desc', index: 1, count: 1 },
    ])
    expect(transformsOfColumn(table, 'c')).toEqual([{ kind: 'filter' }])
    expect(transformsOfColumn(table, 'd')).toEqual([
      { kind: 'group', index: 1, count: 1 },
    ])

    act(() => table.setColumnVisibility({ b: false, c: false, d: false }))
    act(() => clearColumnTransforms(table, ['b', 'c', 'd'], 'pointer'))
    expect(slices()).toEqual({ sorting: [], columnFilters: [], grouping: [] })
    expect(
      actions
        .filter(a =>
          ['clearSort', 'clearFilters', 'ungroup'].includes(a.action),
        )
        .map(a => [a.plugin, a.action, a.source]),
    ).toEqual([
      ['columnSorting', 'clearSort', 'pointer'],
      ['columnFiltering', 'clearFilters', 'pointer'],
      ['rowGrouping', 'ungroup', 'pointer'],
    ])
    act(() => root!.unmount())

    // Серверный режим: снятие уходит в колбэки приложения.
    const sorts: unknown[][] = []
    const filters: unknown[][] = []
    mount(
      <Grid
        dataMode="server"
        onToggleColumnSort={(...args) => sorts.push(args.slice(0, 2))}
        onFilterChange={(...args) => filters.push(args.slice(0, 1))}
      />,
    )
    act(() => clearColumnTransforms(table, ['b', 'c'], 'keyboard'))
    expect(sorts).toEqual([['b', false]])
    expect(filters).toEqual([[[]]])
    act(() => root!.unmount())

    mount(<Grid plugins="none" />)
    expect(columnTransformsOf(table)).toEqual([])
    act(() => root!.unmount())
    mount(<Grid plugins="disabled" />)
    expect(columnTransformsOf(table)).toEqual([])
    expect(transformsOfColumn(table, 'b')).toEqual([])
  })
})
