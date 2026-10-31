// @vitest-environment happy-dom
/**
 * Пагинация в серверной модели строк на таблице (ADR 0158; SP1, SP3, SP9, SP10).
 * Запуск: npx vitest run --config vitest.node.config.ts serverPagination
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { DataMode } from '../core/dataMode'
import type { RowSource } from '../core/rowSource'
import {
  countSelectionIn,
  rowSelectionValueOf,
  setRowSelectionValue,
} from '../core/rowSelectionAll'
import { isServerAction } from '../core/serverActions'
import { useCreateTable } from '../core/useCreateTable'
import {
  columnSortingModel,
  pagination,
  rowExpanding,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import { toggleRowSelection } from '../plugins/rowSelection/keyboardActions'
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
const TOTAL = 1000
const NO_DATA: Item[] = []
/** Транзакции применяются задачей после кадра; запасной таймер — 100 мс. */
const AFTER_FRAME_MS = 150

let root: Root
let table: any
let calls: Call[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>(resolve => {
    calls.push({ request, resolve })
  })

const Grid = ({
  extra = [],
  dataMode,
}: {
  extra?: readonly unknown[]
  dataMode?: DataMode
}) => {
  table = useCreateTable({
    rowCount: TOTAL,
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    dataMode,
    plugins: [serverRowModel({ getRows, blockSize: BLOCK }), ...extra] as never,
  })
  return null
}

const source = () => table.getRowSource() as RowSource<{ id: string }>
const idAt = (index: number) => source().at(index)?.id
const page = (pageIndex: number) => act(() => table.setPageIndex(pageIndex))

/** Окно тела в индексах страницы: тело сообщает его заново и после смены страницы. */
const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

/** Ответить строками диапазона: `r<номер>`, у детей — `<родитель>.<номер>`. */
const answer = async (call: Call, count?: number) => {
  const { start, end, parentId } = call.request
  const last = count === undefined ? end : Math.min(end, count)
  const prefix = parentId ? `${parentId}.` : 'r'
  await act(async () => {
    call.resolve({
      rows: Array.from({ length: Math.max(0, last - start) }, (_, i) => ({
        id: `${prefix}${start + i}`,
        name: `N${start + i}`,
      })),
      ...(count === undefined ? {} : { rowCount: count }),
    })
  })
}
const answerAll = async () => {
  for (const call of calls) {
    if (!call.request.signal.aborted) await answer(call)
  }
}
const startsOf = (list: readonly Call[]) =>
  list.filter(call => !call.request.parentId).map(call => call.request.start)

const flush = () =>
  act(() => new Promise(resolve => setTimeout(resolve, AFTER_FRAME_MS)))

beforeEach(() => {
  calls = []
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('пагинация в серверной модели строк (ADR 0158)', () => {
  const warnings = captureInertWarnings()

  it('SP1: в SSRM пагинация активна — страница из pageSize строк верхнего уровня, ветка раскрытой строки на странице родителя, запрос — блоки, пересекающие страницу', async () => {
    act(() =>
      root.render(
        <Grid
          extra={[
            pagination({ initialPageSize: 15 }),
            rowExpanding({ hasChildren: row => row.depth === 0 }),
          ]}
        />,
      ),
    )
    const status = (id: string) =>
      (table.getPluginDiagnostics() as { id: string; status: string }[]).find(
        diagnostic => diagnostic.id === id,
      )?.status
    expect(status('pagination')).toBe('active')

    // Окно тела шире страницы: просят только блоки страницы.
    show(0, 40)
    expect(startsOf(calls)).toEqual([0, 10])
    await answerAll()
    expect(source().count()).toBe(15)
    expect(idAt(14)).toBe('r14')
    expect(idAt(15)).toBeUndefined()

    // Вторая страница — корни 15–29: блок 10 уже в кэше, просят блок 20.
    const before = calls.length
    page(1)
    show(0, 40)
    expect(startsOf(calls.slice(before))).toEqual([20])
    await answerAll()
    expect([idAt(0), idAt(14)]).toEqual(['r15', 'r29'])
    expect(source().offset!()).toBe(15)

    // Ветка раскрытой строки — на странице родителя; границы страниц на месте.
    page(0)
    show(0, 40)
    act(() => table.setExpanded({ r1: true }))
    source().count()
    await act(async () => {})
    await answer(
      calls.find(call => call.request.parentId === 'r1')!,
      3,
    )
    expect(source().count()).toBe(18)
    expect([idAt(1), idAt(2), idAt(4), idAt(17)]).toEqual([
      'r1',
      'r1.0',
      'r1.2',
      'r14',
    ])
    page(1)
    expect([idAt(0), source().offset!()]).toEqual(['r15', 18])
  })

  it('SP3: уход со страницы прерывает signal её блоков в пути, поздний ответ не меняет кэш', async () => {
    act(() =>
      root.render(<Grid extra={[pagination({ initialPageSize: 10 })]} />),
    )
    show(0, 9)
    const [first] = calls
    expect(first!.request.start).toBe(0)

    page(5)
    show(0, 9)
    expect(first!.request.signal.aborted).toBe(true)
    // Ответ пришёл после отмены: строк страницы в кэше нет.
    await answer(first!)
    page(0)
    show(0, 9)
    expect(idAt(0)).toBeUndefined()
    expect(calls.at(-1)!.request.start).toBe(0)
    expect(calls.at(-1)).not.toBe(first)
  })

  it('SP9: выбор { all, except }, выделение диапазона и транзакции — по сквозному списку; транзакция сдвигает границы страниц', async () => {
    act(() =>
      root.render(
        <Grid extra={[pagination({ initialPageSize: 5 }), rowSelection()]} />,
      ),
    )
    show(0, 9)
    await answerAll()
    // Третья страница — второй блок: строки за границей страницы загружены.
    page(2)
    show(0, 9)
    await answerAll()

    // Выбор: «все, кроме» строки второй страницы переживает смену страницы.
    page(1)
    show(0, 9)
    act(() => setRowSelectionValue(table, { all: true, except: [] }))
    act(() => toggleRowSelection(source().at(2) as never, {}, undefined))
    expect(rowSelectionValueOf(table)).toEqual({ all: true, except: ['r7'] })
    page(0)
    expect(
      countSelectionIn(rowSelectionValueOf(table) as never, () => TOTAL),
    ).toBe(TOTAL - 1)

    // Строки диапазона страницы — сквозными индексами списка.
    page(1)
    const controller = new AbortController()
    const rows = await act(() => source().loadRange!(0, 4, controller.signal))
    expect(rows.map(row => row?.id)).toEqual(['r5', 'r6', 'r7', 'r8', 'r9'])

    // Корень первой страницы удалён: вторая начинается на корень позже.
    act(() => table.applyRowTransaction({ remove: ['r2'] }))
    await flush()
    expect([idAt(0), idAt(4)]).toEqual(['r6', 'r10'])
    page(0)
    expect([idAt(2), idAt(4)]).toEqual(['r3', 'r5'])
  })

  it('SP10: режим пагинации dataMode в SSRM не действует: страницы режет источник без предупреждений, смена страницы — не серверное действие', async () => {
    act(() =>
      root.render(
        <Grid
          dataMode={{ pagination: 'server' }}
          extra={[pagination({ initialPageSize: 5 }), columnSortingModel()]}
        />,
      ),
    )
    expect(
      warnings().filter(text => text.includes('server row model')),
    ).toEqual([])

    // Страницы режет источник, смена страницы — не серверное действие.
    expect(isServerAction(table, 'pagination')).toBe(false)
    show(0, 9)
    await answerAll()
    page(2)
    show(0, 9)
    await answerAll()
    expect([source().count(), idAt(0)]).toEqual([5, 'r10'])
    // Сортировка возвращает на первую страницу, как без флага.
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    expect(table.store.get().pagination.pageIndex).toBe(0)
  })
})
