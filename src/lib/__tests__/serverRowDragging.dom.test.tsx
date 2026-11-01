// @vitest-environment happy-dom
/**
 * Перетаскивание строк в серверной модели на таблице (ADR 0159; MV1, MV8–MV10).
 * Запуск: npx vitest run --config vitest.node.config.ts serverRowDragging
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { DebugAction } from '../core/debugActions'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnFilteringModel,
  columnSortingModel,
  pagination,
  quickSearchModel,
  rowDragging,
  type RowDragEnd,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import { getRowDraggingEvents } from '../plugins/rowDragging'
import { moveRowKeyboardAction } from '../plugins/rowDragging/keyboardActions'
import {
  canMoveRow,
  canMoveRowToEdge,
  moveRow,
  moveRowToEdge,
} from '../plugins/rowDragging/moveRow'
import { captureInertWarnings } from './inertWarnings'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
}

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const BLOCK = 10
const TOTAL = 100
const NO_DATA: Item[] = []

let root: Root
let table: any
let calls: Call[]
/** Порядок строк «сервера»: переносы, которые он принял, меняют его. */
let items: Item[]
let ends: RowDragEnd[]
let actions: DebugAction[]
/** Ответ на перенос: промис, который тест выполняет сам. */
let settleMove: ((ok: boolean) => void) | undefined

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

const Grid = ({
  extra = [],
  knownTotal = true,
}: {
  extra?: readonly unknown[]
  knownTotal?: boolean
}) => {
  table = useCreateTable({
    rowCount: knownTotal ? TOTAL : undefined,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    onDebugAction: (action: DebugAction) => actions.push(action),
    plugins: [
      serverRowModel({
        getRows,
        blockSize: BLOCK,
      }),
      rowDragging({ onRowDragEnd }),
      ...extra,
    ] as never,
  })
  return null
}

const source = () => table.getRowSource() as RowSource<any>
const idAt = (index: number) => source().at(index)?.id
const rowOf = (id: string) => source().byId(id)
const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

/** Ответить строками «сервера» в его нынешнем порядке. */
const answer = async (call: Call, known = true) => {
  const { start, end } = call.request
  await act(async () => {
    call.resolve({
      rows: items.slice(start, end),
      ...(known ? { rowCount: items.length } : {}),
    })
  })
}
const answerOpen = async (known = true) => {
  for (const call of calls) {
    if (!call.request.signal.aborted) await answer(call, known)
  }
  calls = calls.filter(call => call.request.signal.aborted)
}

const statusOf = (id: string) =>
  (
    table.getPluginDiagnostics() as {
      id: string
      status: string
      reason?: string
    }[]
  ).find(diagnostic => diagnostic.id === id)

beforeEach(() => {
  calls = []
  ends = []
  actions = []
  settleMove = undefined
  items = Array.from({ length: TOTAL }, (_, k) => ({
    id: `r${k}`,
    name: `N${k}`,
  }))
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('перетаскивание строк в серверной модели (ADR 0159)', () => {
  captureInertWarnings()

  it('MV1: rowDragging в SSRM активен; при серверной сортировке, фильтре или поиске инертен с причиной', () => {
    act(() =>
      root.render(
        <Grid
          extra={[
            columnSortingModel(),
            columnFilteringModel(),
            quickSearchModel(),
          ]}
        />,
      ),
    )
    expect(statusOf('rowDragging')).toEqual({
      id: 'rowDragging',
      status: 'active',
    })
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    expect(statusOf('rowDragging')?.reason).toBe('sorting')
    act(() => table.setSorting([]))
    act(() =>
      table.setColumnFilters([
        { id: 'name', value: { operator: 'contains', value: 'N' } },
      ]),
    )
    expect(statusOf('rowDragging')?.reason).toBe('filtering')
    act(() => table.setColumnFilters([]))
    act(() => table.setGlobalFilter('N'))
    expect(statusOf('rowDragging')?.reason).toBe('filtering')
    act(() => table.setGlobalFilter(''))
    expect(statusOf('rowDragging')?.status).toBe('active')
  })

  it('MV8: меню ручки — «вверх» и «вниз» к соседям, «в начало» и «в конец» по индексу итога; клавиатурный перенос', async () => {
    act(() =>
      root.render(<Grid extra={[pagination({ initialPageSize: 5 })]} />),
    )
    show(0, 9)
    await answerOpen()
    // Вторая страница: строки 5–9; вверх с первой строки страницы — на прошлую.
    act(() => table.setPageIndex(1))
    show(0, 9)
    expect(canMoveRow(rowOf('r5'), table, -1)).toBe(true)
    act(() => moveRow(rowOf('r5'), table, -1))
    expect(ends.at(-1)).toMatchObject({ rowId: 'r5', index: 4 })
    expect(source().listIndexOf!('r5')).toBe(4)
    act(() => settleMove?.(true))

    act(() => moveRow(rowOf('r6'), table, 1))
    expect(source().listIndexOf!('r6')).toBe(7)
    act(() => settleMove?.(true))

    act(() => moveRowToEdge(rowOf('r8'), table, 'start'))
    expect(source().listIndexOf!('r8')).toBe(0)
    act(() => settleMove?.(true))
    // Конец списка — за окном: строка уходит из кэша, отказ ставит её на прежнее место.
    const before = source().listIndexOf!('r9')
    act(() => moveRowToEdge(rowOf('r9'), table, 'end'))
    expect(ends.at(-1)).toMatchObject({ rowId: 'r9', index: TOTAL - 1 })
    expect(source().listIndexOf!('r9')).not.toBe(before)
    await act(async () => settleMove?.(false))
    expect(source().listIndexOf!('r9')).toBe(before)
    expect(source().total!()).toBe(TOTAL)

    // Клавиатура — тем же путём.
    const row = rowOf('r7')
    act(() =>
      moveRowKeyboardAction.run(
        { row, table } as never,
        new KeyboardEvent('keydown', { key: 'ArrowUp' }) as never,
      ),
    )
    expect(ends.at(-1)).toMatchObject({ rowId: 'r7' })
    expect(source().listIndexOf!('r7')).toBe(ends.at(-1)!.index)
    act(() => settleMove?.(true))

    // Итог неизвестен — конца списка нет.
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    calls = []
    act(() => root.render(<Grid knownTotal={false} />))
    show(0, 9)
    await answerOpen(false)
    expect(canMoveRowToEdge(rowOf('r3'), table, 'end')).toBe(false)
    expect(canMoveRowToEdge(rowOf('r3'), table, 'start')).toBe(true)
    expect(canMoveRow(rowOf('r0'), table, -1)).toBe(false)
  })

  it('MV9: блок, запрошенный до переноса и пришедший после, сверяется по id — ни дублей, ни пропусков', async () => {
    act(() => root.render(<Grid />))
    show(0, 19)
    await answerOpen()
    // Третий блок в пути, перенос задевает его место.
    show(0, 29)
    const before = calls.find(call => call.request.start === 20)!
    // Порядок, в котором «сервер» собрал блок 20, — до переноса.
    const stale = items.slice(20, 30)
    // Перенос r15 на место 25 — его же «сервер» принял потом.
    act(() => {
      const from = items.findIndex(item => item.id === 'r15')
      items.splice(25, 0, ...items.splice(from, 1))
    })
    expect(source().moveRow!('r15', { index: 25 })).toBe(true)
    await act(async () => before.resolve({ rows: stale, rowCount: TOTAL }))
    await answerOpen()
    show(0, 29)
    await answerOpen()
    const ids = Array.from({ length: 30 }, (_, k) => idAt(k))
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(30)
    expect(ids.filter(id => id === 'r15')).toEqual(['r15'])
  })

  it('MV10: перенос в SSRM — действия канала rowDragging с источником и итогом промиса', async () => {
    act(() => root.render(<Grid />))
    show(0, 9)
    await answerOpen()
    const sortable = (index: number) => ({
      id: idAt(index)!,
      data: { current: { row: source().at(index), virtualIndex: index } },
    })
    const active = sortable(1)
    act(() => getRowDraggingEvents(table).onRowDragStart!({ active } as never))
    act(() =>
      getRowDraggingEvents(table).onRowDragMove!({
        active,
        over: sortable(4),
        delta: { x: 0, y: 0 },
      } as never),
    )
    act(() =>
      getRowDraggingEvents(table).onRowDragEnd!({
        active,
        over: sortable(4),
      } as never),
    )
    expect(source().listIndexOf!('r1')).toBe(4)
    const drop = actions.find(
      action => action.plugin === 'rowDragging' && action.action === 'drop',
    )
    expect(drop).toMatchObject({
      source: 'pointer',
      detail: { rowId: 'r1', index: 4 },
    })
    await act(async () => settleMove?.(false))
    const outcome = actions.find(
      action =>
        action.plugin === 'rowDragging' &&
        action.action === 'commitMoveRejected',
    )
    expect(outcome?.cause).toBeDefined()
    // Отказ вернул строку.
    expect(source().listIndexOf!('r1')).toBe(1)
  })
})
