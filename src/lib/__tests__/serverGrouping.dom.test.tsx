// @vitest-environment happy-dom
/**
 * Серверная группировка на таблице (ADR 0144; GS1–GS2, GS10–GS11): поля запроса,
 * строки-группы и их ветки, запрос выгрузки, инертность клиентской модели и ленивых детей;
 * MV12 — `update` строки-группы по пути значений (ADR 0159).
 * Запуск: npx vitest run --config vitest.node.config.ts serverGrouping
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import { serverAggregationsOf } from '../shared/serverAggregations'
import { __resetLogger } from '../util/logger'
import {
  dataExport,
  type ExportRequest,
  rowExpanding,
  rowGrouping,
  rowGroupingModel,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import { captureInertWarnings } from './inertWarnings'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  country: string
  city: string
  amount: number
  count?: number
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
}

const COLUMNS = [
  { id: 'country', accessorKey: 'country' },
  { id: 'city', accessorFn: (row: Item) => row.city },
  { id: 'amount', accessorKey: 'amount', aggregationFn: 'sum' },
]
const NO_DATA: Item[] = []

let root: Root
let table: any
let calls: Call[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>(resolve => {
    calls.push({ request, resolve })
  })

const Grid = ({ plugins }: { plugins: readonly unknown[] }) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    dataMode: { export: 'server' },
    plugins: [
      serverRowModel({
        getRows,
        blockSize: 10,
        getGroupChildCount: (row: Item) => row.count,
      }),
      ...plugins,
    ] as never,
  })
  return null
}

const source = () =>
  table.getRowSource() as RowSource<{
    id: string
    depth: number
    groupingColumnId?: string
    groupingValue?: unknown
    getIsGrouped: () => boolean
    getCanExpand: () => boolean
  }>

const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

const respond = async (call: Call, rows: Item[], rowCount = rows.length) => {
  await act(async () => call.resolve({ rows, rowCount }))
}

/** Раскрыть строки и прочесть число строк, как тело на перерисовке. */
const expand = async (expanded: Record<string, boolean>) => {
  act(() => table.setExpanded(expanded))
  source().count()
  await act(async () => {})
}

const group = (country: string, city = '', count?: number): Item => ({
  id: '',
  country,
  city,
  amount: 100,
  count,
})

beforeEach(() => {
  calls = []
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('серверная группировка на таблице (ADR 0144)', () => {
  const warnings = captureInertWarnings()

  it('GS15: функция, список или определение { aggregate } в aggregationFn дают dev-warn с id колонки', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetLogger()
    try {
      const host = {
        options: {},
        getAllLeafColumns: () => [
          { id: 'fn', columnDef: { aggregationFn: () => 1 } },
          { id: 'list', columnDef: { aggregationFn: ['sum', 'mean'] } },
          { id: 'def', columnDef: { aggregationFn: { aggregate: () => 1 } } },
          { id: 'auto', columnDef: { aggregationFn: 'auto' } },
          { id: 'plain', columnDef: {} },
        ],
      }
      expect(serverAggregationsOf(host)).toEqual({})
      const said = warn.mock.calls.flat().map(String).join(' ')
      for (const id of ['fn', 'list', 'def']) expect(said).toContain(`"${id}"`)
      expect(said).not.toContain('"auto"')
      expect(said).not.toContain('"plain"')
    } finally {
      warn.mockRestore()
    }
  })

  it('GS16: своё строковое имя агрегата доходит до сервера в aggregations', () => {
    expect(
      serverAggregationsOf({
        options: {},
        getAllLeafColumns: () => [
          { id: 'amount', columnDef: { aggregationFn: 'p95' } },
        ],
      }),
    ).toEqual({ amount: 'p95' })
  })

  it('GS1: запрос getRows несёт grouping, groupKeys и aggregations из явных строковых aggregationFn колонок — и без группировки; без группировки grouping и groupKeys пустые', async () => {
    act(() => root.render(<Grid plugins={[rowGrouping()]} />))
    show(0, 9)
    expect(calls.at(-1)!.request).toMatchObject({ grouping: [], groupKeys: [] })
    // Умолчание TanStack `'auto'` у прочих колонок в запрос не идёт.
    expect(calls.at(-1)!.request.aggregations).toEqual({ amount: 'sum' })

    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    calls = []
    act(() =>
      root.render(
        <Grid
          plugins={[rowGrouping({ initialGrouping: ['country', 'city'] })]}
        />,
      ),
    )
    show(0, 9)
    const rootCall = calls.at(-1)!
    expect(rootCall.request).toMatchObject({
      grouping: ['country', 'city'],
      groupKeys: [],
      aggregations: { amount: 'sum' },
    })
    await respond(rootCall, [group('US'), group('FR')])
    await expand({ [source().at(0)!.id]: true })
    expect(calls.at(-1)!.request).toMatchObject({
      grouping: ['country', 'city'],
      groupKeys: ['US'],
      parentId: 'group:["US"]',
    })
  })

  it('GS2: пока groupKeys короче grouping, ответ — строки-группы с id из пути и значением сгруппированной колонки; строки последнего уровня — строки данных с getRowId', async () => {
    act(() =>
      root.render(
        <Grid
          plugins={[
            rowGrouping({ initialGrouping: ['country', 'city'] }),
            rowExpanding(),
          ]}
        />,
      ),
    )
    show(0, 9)
    // Строка данных с id, похожим на значение группы, с id группы не совпадает.
    await respond(calls.at(-1)!, [group('US', '', 3), group('FR')])
    const us = source().at(0)!
    expect(us).toMatchObject({
      id: 'group:["US"]',
      depth: 0,
      groupingColumnId: 'country',
      groupingValue: 'US',
    })
    expect(us.getIsGrouped()).toBe(true)
    expect(us.getCanExpand()).toBe(true)
    // Число строк группы — итог её ветки до ответа.
    expect(source().groupChildCount!(us)).toBe(3)
    await expand({ [us.id]: true })
    expect(source().count()).toBe(2 + 3)

    // Второй уровень — группы по городу (значение через accessorFn).
    await respond(calls.at(-1)!, [group('US', 'NY', 2)], 3)
    const ny = source().at(1)!
    expect(ny).toMatchObject({
      id: 'group:["US","NY"]',
      depth: 1,
      groupingColumnId: 'city',
      groupingValue: 'NY',
    })
    await expand({ [us.id]: true, [ny.id]: true })
    expect(calls.at(-1)!.request.groupKeys).toEqual(['US', 'NY'])
    await respond(calls.at(-1)!, [
      { id: 'US', country: 'US', city: 'NY', amount: 1 },
      { id: 'o2', country: 'US', city: 'NY', amount: 2 },
    ])
    const leaf = source().at(2)!
    expect(leaf).toMatchObject({ id: 'US', depth: 2 })
    expect(leaf.getIsGrouped()).toBe(false)
    expect(source().indexOf('US')).toBe(2)
    expect(source().indexOf('group:["US"]')).toBe(0)
  })

  it('MV12: update транзакции с данными строки-группы обновляет её по пути значений — parentId ветки и значению колонки группировки уровня; строки данных — по id, как прежде', async () => {
    act(() =>
      root.render(
        <Grid
          plugins={[
            rowGrouping({ initialGrouping: ['country', 'city'] }),
            rowExpanding(),
          ]}
        />,
      ),
    )
    show(0, 9)
    await respond(calls.at(-1)!, [group('US', '', 3), group('FR', '', 1)])
    await expand({ 'group:["US"]': true })
    await respond(calls.at(-1)!, [group('US', 'NY', 2)])
    await expand({ 'group:["US"]': true, 'group:["US","NY"]': true })
    await respond(calls.at(-1)!, [
      { id: 'o1', country: 'US', city: 'NY', amount: 1 },
      { id: 'o2', country: 'US', city: 'NY', amount: 2 },
    ])
    const countOf = (id: string) =>
      source().groupChildCount!(source().byId(id)!)
    const amountOf = (id: string) =>
      (source().byId(id) as unknown as { original: Item }).original.amount

    // Верхний уровень — без parentId.
    act(() => table.applyRowTransaction({ update: [group('FR', '', 7)] }))
    expect(countOf('group:["FR"]')).toBe(7)
    // Второй уровень — в ветке группы US.
    act(() =>
      table.applyRowTransaction({
        parentId: 'group:["US"]',
        update: [group('US', 'NY', 9)],
      }),
    )
    expect(countOf('group:["US","NY"]')).toBe(9)
    expect(countOf('group:["US"]')).toBe(3)
    // Строка данных — по своему id, без parentId.
    act(() =>
      table.applyRowTransaction({
        update: [{ id: 'o2', country: 'US', city: 'NY', amount: 5 }],
      }),
    )
    expect(amountOf('o2')).toBe(5)
    expect(source().indexOf('o2')).toBe(3)
  })

  it('GS10: серверная выгрузка получает grouping и aggregations в query', async () => {
    const exports: ExportRequest[] = []
    act(() =>
      root.render(
        <Grid
          plugins={[
            rowGrouping({ initialGrouping: ['country'] }),
            dataExport({
              onExport: request => {
                exports.push(request)
              },
            }),
          ]}
        />,
      ),
    )
    show(0, 9)
    await respond(calls.at(-1)!, [group('US')])
    await act(() => table.exportData({ rows: 'all' }))
    expect(exports).toHaveLength(1)
    expect(exports[0]!.query).toMatchObject({ grouping: ['country'] })
    expect(exports[0]!.query!.aggregations).toEqual({ amount: 'sum' })
  })

  it("GS11: rowGroupingModel в SSRM инертен с причиной 'serverRowModel'; при группировке строки данных детей не раскрывают, dev-warn", async () => {
    act(() => root.render(<Grid plugins={[rowGroupingModel()]} />))
    expect(table.getPluginDiagnostics()).toContainEqual({
      id: 'rowGroupingModel',
      status: 'inert',
      reason: 'serverRowModel',
    })
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))

    act(() =>
      root.render(
        <Grid
          plugins={[
            rowGrouping({ initialGrouping: ['country'] }),
            rowExpanding({ hasChildren: () => true, maxDepth: 3 }),
          ]}
        />,
      ),
    )
    show(0, 9)
    await respond(calls.at(-1)!, [group('US', '', 1)])
    await expand({ 'group:["US"]': true })
    await respond(calls.at(-1)!, [
      { id: 'o1', country: 'US', city: 'NY', amount: 1 },
    ])
    const leaf = source().at(1)!
    expect(leaf.id).toBe('o1')
    // Ленивые дети при группировке не раскрываются.
    expect(leaf.getCanExpand()).toBe(false)
    expect(
      warnings().some(
        text => text.includes('rowExpanding') && text.includes('rowGrouping'),
      ),
    ).toBe(true)
  })
})
