// @vitest-environment happy-dom
/**
 * Вложение, вынос и соседние группы в серверной модели на таблице (ADR 0189; NT1–NT3, NT6–NT7,
 * NT10–NT11).
 * Запуск: npx vitest run --config vitest.node.config.ts serverRowShift
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { DebugAction } from '../core/debugActions'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  rowDragging,
  rowExpanding,
  rowGrouping,
  type RowDragEnd,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import {
  canNestRow,
  canUnnestRow,
  nestRow,
  unnestRow,
} from '../plugins/rowDragging/moveRow'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
  city?: string
  count?: number
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name' },
  { id: 'city', accessorKey: 'city' },
]
const NO_DATA: Item[] = []
const TOTAL = 40
const BLOCK = 10
const CITIES = ['A', 'B', 'C']

let root: Root
let table: any
let calls: Call[]
let ends: RowDragEnd[]
let actions: DebugAction[]
let settleMove: ((ok: boolean) => void) | undefined
/** Ветка отвечает без итога: конца у неё нет. */
let unknownBranch = false

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>(resolve => {
    calls.push({ request, resolve })
  })

const onRowDragEnd = (end: RowDragEnd) => {
  ends.push(end)
  return new Promise<void>((resolve, reject) => {
    settleMove = ok => (ok ? resolve() : reject(new Error('refused')))
  })
}

const Grid = ({ grouped = false }: { grouped?: boolean }) => {
  table = useCreateTable({
    rowCount: grouped ? undefined : TOTAL,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    onDebugAction: (action: DebugAction) => actions.push(action),
    plugins: [
      serverRowModel({
        getRows,
        blockSize: BLOCK,
        getGroupChildCount: (row: Item) => row.count,
      }),
      rowDragging({ onRowDragEnd }),
      ...(grouped
        ? [rowGrouping({ initialGrouping: ['city'] }), rowExpanding()]
        : [
            rowExpanding({
              hasChildren: row =>
                (row as { depth: number }).depth === 0 &&
                ['r1', 'r3', 'r9'].includes((row as { id: string }).id),
            }),
          ]),
    ] as never,
  })
  return null
}

const source = () => table.getRowSource() as RowSource<any>
const rowOf = (id: string) => source().byId(id)
const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

const answerCall = async ({ request, resolve }: Call) => {
  const { start, end, parentId, grouping, groupKeys, signal } = request
  if (signal.aborted) return
  await act(async () => {
    if (groupKeys.length < grouping.length) {
      resolve({
        rows: CITIES.map(city => ({ id: '', name: '', city, count: 3 })),
        rowCount: 3,
      })
      return
    }
    if (parentId) {
      const prefix = String(groupKeys[0] ?? parentId)
      // Полный блок без итога: конец ветки неизвестен.
      const rows = Array.from(
        { length: unknownBranch ? BLOCK : 3 },
        (_, k) => ({
          id: `${prefix}.${k}`,
          name: `${prefix}.${k}`,
        }),
      )
      resolve({
        rows: rows.slice(start, end),
        ...(unknownBranch ? {} : { rowCount: 3 }),
      })
      return
    }
    resolve({
      rows: Array.from({ length: Math.min(end, TOTAL) - start }, (_, k) => ({
        id: `r${start + k}`,
        name: `N${start + k}`,
      })),
      rowCount: TOTAL,
    })
  })
}

const answerOpen = async () => {
  while (calls.length > 0) await answerCall(calls.shift()!)
}

const expand = async (id: string) => {
  act(() => rowOf(id).toggleExpanded(true))
  show(0, 12)
  await answerOpen()
}

beforeEach(() => {
  calls = []
  ends = []
  actions = []
  settleMove = undefined
  unknownBranch = false
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

const mount = async (grouped = false) => {
  act(() => root.render(<Grid grouped={grouped} />))
  show(0, 12)
  await answerOpen()
}

describe('вложение и вынос в SSRM (ADR 0189)', () => {
  it('NT1: «Вложить» кладёт строку в предыдущую сестру-ветку на любой глубине', async () => {
    await mount()
    await expand('r1')
    act(() => nestRow(rowOf('r2'), table))
    expect(rowOf('r2').parentId).toBe('r1')
    expect(rowOf('r2').index).toBe(3)
    expect(ends[0]).toMatchObject({ parentId: 'r1', index: 3 })
  })

  it('NT2: «Вынести» ставит строку сразу за родителем, на его уровень', async () => {
    await mount()
    await expand('r1')
    act(() => unnestRow(rowOf('r1.1'), table))
    expect(rowOf('r1.1').parentId).toBeUndefined()
    expect(rowOf('r1.1').index).toBe(2)
    expect(ends[0]).toMatchObject({
      parentId: undefined,
      previousParentId: 'r1',
      index: 2,
    })
  })

  it('NT3: меню и клавиши дают тот же onRowDragEnd, промис и откат, что бросок', async () => {
    await mount()
    await expand('r1')
    act(() => nestRow(rowOf('r2'), table))
    expect(ends[0]).toMatchObject({
      rowId: 'r2',
      parentId: 'r1',
      previousParentId: undefined,
      index: 3,
    })
    expect(table.atoms.rowMoves.get().r2?.pending).toBe(true)
    await act(async () => settleMove!(false))
    expect(rowOf('r2').parentId).toBeUndefined()
    expect(rowOf('r2').index).toBe(2)
    expect(table.atoms.rowMoveFailed.get().r2).toBeDefined()
  })

  it('NT6: строка становится последней при известном итоге ветки, иначе первой', async () => {
    await mount()
    await expand('r1')
    act(() => nestRow(rowOf('r2'), table))
    expect(rowOf('r2').index).toBe(3)
    await act(async () => settleMove!(true))

    unknownBranch = true
    await expand('r3')
    act(() => nestRow(rowOf('r4'), table))
    expect(rowOf('r4').parentId).toBe('r3')
    expect(rowOf('r4').index).toBe(0)
  })

  it('NT7: пункт недоступен, а клавиша инертна, если цели нет или она не загружена', async () => {
    await mount()
    await expand('r1')
    // Первая строка уровня, сестра без ветки, строка верхнего уровня у выноса.
    expect(canNestRow(rowOf('r0'), table)).toBe(false)
    expect(canNestRow(rowOf('r5'), table)).toBe(false)
    expect(canUnnestRow(rowOf('r5'), table)).toBe(false)
    expect(canNestRow(rowOf('r1.0'), table)).toBe(false)
    expect(canUnnestRow(rowOf('r1.0'), table)).toBe(true)
    act(() => nestRow(rowOf('r0'), table))
    act(() => unnestRow(rowOf('r5'), table))
    expect(ends).toEqual([])
    // Сестра-ветка не загружена: первая строка второго блока без первого блока.
    act(() => table.refreshRows({ purge: true }))
    show(10, 19)
    await answerOpen()
    expect(rowOf('r9')).toBeUndefined()
    expect(rowOf('r10')).toBeDefined()
    expect(canNestRow(rowOf('r10'), table)).toBe(false)
  })

  it('NT10: соседней группы нет или она не загружена — пункт недоступен, клавиша инертна', async () => {
    await mount(true)
    await expand('group:["A"]')
    expect(canUnnestRow(rowOf('A.0'), table)).toBe(false)
    expect(canNestRow(rowOf('A.0'), table)).toBe(true)
    act(() => unnestRow(rowOf('A.0'), table))
    expect(ends).toEqual([])
    await expand('group:["C"]')
    expect(canNestRow(rowOf('C.0'), table)).toBe(false)
    expect(canUnnestRow(rowOf('C.0'), table)).toBe(true)
  })

  it('NT11: канал действий — источник переноса и ожидание ветки', async () => {
    await mount()
    act(() => nestRow(rowOf('r2'), table))
    expect(ends).toEqual([])
    show(0, 12)
    await answerOpen()
    await act(async () => settleMove!(true))
    const names = actions
      .filter(action => action.plugin === 'rowDragging')
      .map(action => action.action)
    expect(names).toEqual(['awaitBranch', 'commitMoveResolved'])
    expect(ends[0]).toMatchObject({ parentId: 'r1', index: 3 })
  })
})
