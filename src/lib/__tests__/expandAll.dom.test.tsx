// @vitest-environment happy-dom
/**
 * «Раскрыть всё» (ADR 0160; EA1–EA2, EA5): в серверной модели строк — раскрыты все группы,
 * детей просят только строки окна очередью блоков; свёрнутые вручную — исключения среза;
 * кнопку выключает аргумент фабрики.
 * Запуск: npx vitest run --config vitest.node.config.ts expandAll
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import { ExpandAllComponent } from '../plugins/rowExpanding/ExpandAllComponent'
import {
  rowExpanding,
  rowGrouping,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  country: string
  amount: number
  count?: number
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
}

const COLUMNS = [
  { id: 'country', accessorKey: 'country' },
  { id: 'amount', accessorKey: 'amount' },
]
const NO_DATA: Item[] = []
/** Групп в выборке и строк в каждой. */
const GROUPS = 30
const MEMBERS = 5

let root: Root
let table: any
let calls: Call[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>(resolve => {
    calls.push({ request, resolve })
  })

const Grid = () => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({
        getRows,
        blockSize: 10,
        getGroupChildCount: (row: Item) => row.count,
      }),
      rowGrouping({ initialGrouping: ['country'] }),
      rowExpanding(),
    ] as never,
  })
  return null
}

const source = () =>
  table.getRowSource() as RowSource<{
    id: string
    getIsExpanded: () => boolean
    toggleExpanded: (open?: boolean) => void
  }>

const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

const groupId = (k: number) => `group:${JSON.stringify([`G${k}`])}`
const groupsOf = (start: number, end: number): Item[] =>
  Array.from({ length: end - start }, (_, k) => ({
    id: '',
    country: `G${start + k}`,
    amount: 1,
    count: MEMBERS,
  }))

/** Ответить на запрос: корни — группы, ветка группы — её строки. */
const answer = async (call: Call) => {
  const { start, end, parentId } = call.request
  const rows = parentId
    ? Array.from({ length: Math.min(end, MEMBERS) - start }, (_, k) => ({
        id: `${parentId}/${start + k}`,
        country: '',
        amount: 1,
      }))
    : groupsOf(start, Math.min(end, GROUPS))
  await act(async () =>
    call.resolve({ rows, rowCount: parentId ? MEMBERS : GROUPS }),
  )
}

/** Запросы веток, ещё без ответа. */
const branchCalls = () => calls.filter(call => call.request.parentId)

beforeEach(() => {
  calls = []
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('«Раскрыть всё» (ADR 0160)', () => {
  it('EA1: SSRM, expanded: true — раскрыты все группы и ветки; детей запрашивают только строки окна, очередью блоков; прокрутка раскрывает пришедшие', async () => {
    act(() => root.render(<Grid />))
    show(0, 9)
    await answer(calls.at(-1)!)
    expect(source().count()).toBe(GROUPS)

    act(() => table.setExpanded(true))
    expect(source().count()).toBe(10 * (1 + MEMBERS) + (GROUPS - 10))
    await act(async () => {})
    // Окно 0–9 — группы G0 и G1 с их строками: детей просят только они.
    expect(branchCalls().map(call => call.request.parentId)).toEqual([
      groupId(0),
      groupId(1),
    ])
    expect(source().at(0)!.getIsExpanded()).toBe(true)

    // Прокрутка к группам второго блока корней: они пришли — и раскрыты, их ветки — в
    // очереди не больше двух сразу.
    const before = calls.length
    show(60, 69)
    await act(async () => {})
    const rootBlock = calls.slice(before).find(call => !call.request.parentId)!
    expect(rootBlock.request.start).toBe(10)
    await answer(rootBlock)
    await act(async () => {})
    const later = calls.slice(before).filter(call => call.request.parentId)
    expect(later.length).toBeGreaterThan(0)
    expect(later.length).toBeLessThanOrEqual(2)
    const firstNew = source().indexOf(groupId(10))
    expect(source().at(firstNew)!.getIsExpanded()).toBe(true)
    expect(source().count()).toBe(20 * (1 + MEMBERS) + (GROUPS - 20))
  })

  it('EA2: свёрнутая вручную при «раскрыть всё» — исключение среза «всё, кроме»; «свернуть всё» сбрасывает исключения', async () => {
    act(() => root.render(<Grid />))
    show(0, 9)
    await answer(calls.at(-1)!)
    act(() => table.setExpanded(true))
    const all = source().count()

    act(() => source().at(0)!.toggleExpanded(false))
    expect(table.atoms.expanded.get()).toEqual({
      all: true,
      except: [groupId(0)],
    })
    expect(source().at(0)!.getIsExpanded()).toBe(false)
    expect(source().count()).toBe(all - MEMBERS)
    // Остальные группы раскрыты по-прежнему.
    expect(source().at(1)!.getIsExpanded()).toBe(true)

    act(() => source().at(0)!.toggleExpanded(true))
    expect(table.atoms.expanded.get()).toEqual({ all: true, except: [] })

    act(() => source().at(0)!.toggleExpanded(false))
    act(() => table.setExpanded({}))
    expect(source().count()).toBe(GROUPS)
    act(() => table.setExpanded({ all: true, except: [] }))
    expect(source().at(0)!.getIsExpanded()).toBe(true)
    expect(source().count()).toBe(all)
  })
})

describe('Кнопка «Раскрыть всё» (ADR 0160)', () => {
  it('EA5: кнопку выключает аргумент фабрики expandAll: false; без неё раскрытие — только по строкам', () => {
    interface Node {
      id: string
      subRows?: Node[]
    }
    const data: Node[] = [{ id: 'a', subRows: [{ id: 'a1' }] }, { id: 'b' }]
    let tree: any
    const Tree = ({ expandAll }: { expandAll?: boolean }) => {
      tree = useCreateTable({
        columns: [{ id: 'id', accessorKey: 'id' }] as never,
        data,
        getRowId: (row: Node) => row.id,
        getSubRows: (row: Node) => row.subRows,
        plugins: [rowExpanding({ expandAll })] as never,
      } as never)
      return (
        <ExpandAllComponent
          {...({ table: tree, hooks: {} } as Parameters<
            typeof ExpandAllComponent
          >[0])}
        />
      )
    }
    const host = document.createElement('div')
    const view = createRoot(host)
    try {
      act(() => view.render(<Tree />))
      expect(host.querySelector('.row-expand-all-button')).not.toBeNull()

      act(() => view.render(<Tree expandAll={false} />))
      expect(host.querySelector('.row-expand-all-button')).toBeNull()
      // Строки раскрываются по одной, как прежде.
      act(() => tree.getRowModel().rows[0].toggleExpanded(true))
      expect(tree.getRowModel().rows.map((row: Node) => row.id)).toEqual([
        'a',
        'a1',
        'b',
      ])
    } finally {
      act(() => view.unmount())
    }
  })
})
