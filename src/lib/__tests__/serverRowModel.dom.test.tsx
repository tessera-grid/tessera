// @vitest-environment happy-dom
/**
 * Серверная модель строк на таблице (ADR 0138; SD9, SD22–SD23, SD37–SD38): закреплённые
 * блоки и живой `maxBlocks`, перезапрос окна и замена строки, инертность без загрузчика,
 * канал действий.
 * Запуск: npx vitest run --config vitest.node.config.ts serverRowModel
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { pluginStateKey, setPluginState } from '../core/definePlugin'
import type { DebugAction } from '../core/debugActions'
import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  infiniteScroll,
  keyboardNavigation,
  pagination,
  paginationModel,
  rowDragging,
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
  name: string
}

interface Call {
  request: ServerRowsRequest
  resolve: (response: ServerRowsResponse<Item>) => void
  reject: (reason: unknown) => void
}

const COLUMNS = [{ id: 'name', accessorKey: 'name' }]
const BLOCK = 10
const NO_DATA: Item[] = []

let root: Root
let table: any
let calls: Call[]

const getRows = (request: ServerRowsRequest) =>
  new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
    calls.push({ request, resolve, reject })
  })

const Grid = ({
  maxBlocks = 2,
  loader = true,
  onDebugAction,
  rowId = (row: Item) => row.id,
  extra = [],
}: {
  maxBlocks?: number
  loader?: boolean
  onDebugAction?: (report: DebugAction) => void
  rowId?: (row: Item) => string
  extra?: readonly unknown[]
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: rowId,
    onDebugAction: onDebugAction as never,
    plugins: [
      serverRowModel({
        getRows: loader ? getRows : undefined,
        rowCount: 1000,
        blockSize: BLOCK,
        maxBlocks,
      }),
      keyboardNavigation(),
      cellEditing(),
      ...extra,
    ] as never,
  })
  return null
}

/** SD13, типы: строка без строкового `id` и без `getRowId` — ошибка компиляции. */
export const NoRowIdGrid = () => {
  // @ts-expect-error — getRowId обязателен, когда у строки нет строкового id.
  useCreateTable({
    columns: COLUMNS as never,
    data: [] as { name: string }[],
    plugins: [serverRowModel({ getRows })] as never,
  })
  return null
}

const source = () => table.getRowSource() as RowSource<{ id: string }>

/** Окно строк `[first, last]` — как его сообщает тело. */
const show = (first: number, last: number) =>
  act(() => source().observe!({ first, last, fast: false }))

/** Ответить на последний запрос строками его диапазона. */
const answer = async (call = calls.at(-1)!) => {
  const { start, end } = call.request
  await act(async () => {
    call.resolve({
      rows: Array.from({ length: end - start }, (_, i) => ({
        id: `r${start + i}`,
        name: `N${start + i}`,
      })),
    })
  })
}

const loaded = (index: number) => source().at(index) !== undefined

beforeEach(() => {
  calls = []
  root = createRoot(document.createElement('div'))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('серверная модель строк на таблице (ADR 0138)', () => {
  const warnings = captureInertWarnings()

  it('SD9: блоки активной ячейки и правки не вытесняются, возврат к вытесненному — новый запрос, maxBlocks живой', async () => {
    act(() => root.render(<Grid />))
    show(0, 9)
    await answer()
    act(() =>
      setPluginState(table, 'keyboardNavigation', {
        rowIndex: 5,
        columnIndex: 0,
      }),
    )
    show(100, 109)
    await answer()
    act(() =>
      setPluginState(table, 'cellEditing', {
        active: { cell: { rowId: 'r105', columnId: 'name' } },
      }),
    )
    for (const start of [200, 300, 400]) {
      show(start, start + 9)
      await answer()
    }
    // Сверх двух блоков держатся закреплённые: активная ячейка и правка; прочие ушли.
    expect(loaded(5)).toBe(true)
    expect(loaded(105)).toBe(true)
    expect(loaded(400)).toBe(true)
    expect(loaded(200)).toBe(false)
    expect(loaded(300)).toBe(false)

    // Возврат к вытесненному блоку — запрос заново.
    const before = calls.length
    show(200, 209)
    expect(calls.length).toBe(before + 1)
    expect(calls.at(-1)!.request.start).toBe(200)
    await answer()

    // maxBlocks на лету: с новым пределом и снятыми закреплениями лишнее уходит без запросов.
    const requested = calls.length
    act(() => root.render(<Grid maxBlocks={1} />))
    act(() => setPluginState(table, 'cellEditing', { active: null }))
    act(() =>
      setPluginState(table, 'keyboardNavigation', {
        rowIndex: 205,
        columnIndex: 0,
      }),
    )
    show(200, 209)
    act(() => root.render(<Grid maxBlocks={1} />))
    expect(loaded(205)).toBe(true)
    expect(loaded(5)).toBe(false)
    expect(loaded(105)).toBe(false)
    expect(loaded(400)).toBe(false)
    expect(calls.length).toBe(requested)
  })

  it("SD37: без getRows плагин инертен с причиной 'noGetRows' и dev-warn, источник строк не подменяется", () => {
    act(() => root.render(<Grid loader={false} />))
    expect(table.getPluginDiagnostics()).toContainEqual({
      id: 'serverRowModel',
      status: 'inert',
      reason: 'noGetRows',
    })
    expect(warnings().some(text => text.includes('noGetRows'))).toBe(true)
    expect(source().observe).toBeUndefined()
    expect(source().count()).toBe(0)
  })

  it('SD38: запрос блока — loadBlock с source auto и диапазоном; ответ, отказ и отмена — с cause запроса', async () => {
    const reports: DebugAction[] = []
    act(() =>
      root.render(<Grid onDebugAction={report => reports.push(report)} />),
    )
    const own = () =>
      reports.filter(report => report.plugin === 'serverRowModel')
    const requestOf = (start: number) =>
      own().find(
        report =>
          report.action === 'loadBlock' &&
          (report.detail as { start: number }).start === start,
      )!
    const outcome = (action: string) =>
      own().find(report => report.action === action)

    show(0, 19)
    expect(requestOf(0)).toMatchObject({
      source: 'auto',
      detail: { start: 0, end: 10 },
    })
    expect(requestOf(10)).toMatchObject({
      source: 'auto',
      detail: { start: 10, end: 20 },
    })
    await answer(calls[0])
    await act(async () => calls[1]!.reject(new Error('down')))
    expect(outcome('loadBlockResolved')).toMatchObject({
      source: 'auto',
      cause: requestOf(0).id,
    })
    expect(outcome('loadBlockRejected')).toMatchObject({
      source: 'auto',
      cause: requestOf(10).id,
      detail: 'down',
    })

    // Блок ушёл из окна до ответа — отмена с cause его запроса.
    show(500, 509)
    show(0, 9)
    expect(outcome('loadBlockCancelled')).toMatchObject({
      source: 'auto',
      cause: requestOf(500).id,
    })
  })

  it('SD13: без getRowId — ошибка типа и dev-warn; строки блоков получают id из getRowId', async () => {
    act(() => root.render(<Grid rowId={row => `x-${row.name}`} />))
    show(0, 9)
    await answer()
    expect(source().at(0)?.id).toBe('x-N0')
    expect(source().indexOf('x-N3')).toBe(3)
    expect(warnings().some(text => text.includes('getRowId'))).toBe(false)

    // Строка без строкового id (данные без getRowId вне проверки типов) — предупреждение.
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    calls = []
    act(() => root.render(<Grid rowId={() => undefined as never} />))
    show(0, 9)
    await answer()
    expect(warnings().some(text => text.includes('getRowId'))).toBe(true)
  })
  it('SD22: refreshRows() перезапрашивает блоки окна, строки остаются до ответа; { purge: true } — со скелетом; прочие блоки кэша сброшены', async () => {
    act(() => root.render(<Grid maxBlocks={10} />))
    const answerAll = async (from: number) => {
      for (const call of calls.slice(from)) await answer(call)
    }
    const startsFrom = (from: number) =>
      calls
        .slice(from)
        .map(call => call.request.start)
        .sort((a, b) => a - b)
    show(100, 109)
    await answerAll(0)
    show(0, 19)
    await answerAll(1)
    expect(loaded(100)).toBe(true)
    const shownRow = source().at(0)

    // Без purge: запрошено окно, строки на экране — прежние, пока ответа нет.
    let before = calls.length
    act(() => table.refreshRows())
    expect(startsFrom(before)).toEqual([0, 10])
    expect(source().at(0)).toBe(shownRow)
    expect(source().refreshing!()).toBe(true)
    await answerAll(before)
    expect(source().refreshing!()).toBe(false)
    expect(loaded(0)).toBe(true)
    expect(source().at(0)).not.toBe(shownRow)
    // Блок вне окна ушёл вместе с прежним кэшем.
    expect(loaded(100)).toBe(false)

    // purge: сразу скелет, окно запрошено заново.
    show(100, 109)
    await answerAll(calls.length - 1)
    show(0, 19)
    before = calls.length
    act(() => table.refreshRows({ purge: true }))
    expect(loaded(0)).toBe(false)
    expect(loaded(100)).toBe(false)
    expect(startsFrom(before)).toEqual([0, 10])
    await answerAll(before)
    expect(loaded(0)).toBe(true)
  })

  it('SD23: setRowData(id, updater) меняет строку в кэше и перерисовывает только её; незагруженная строка — вызов игнорируется', async () => {
    act(() => root.render(<Grid />))
    show(0, 9)
    await answer()
    const version = () =>
      table.atoms[pluginStateKey('serverRowModel')].get() as number
    const nameAt = (index: number) =>
      (source().at(index) as unknown as { original: Item }).original.name
    const neighbour = source().at(1)

    let seen = version()
    act(() =>
      table.setRowData('r0', (row: Item) => ({ ...row, name: 'Changed' })),
    )
    expect(nameAt(0)).toBe('Changed')
    expect(source().byId('r0')).toBe(source().at(0))
    // Соседняя строка — тот же объект: её строка тела не перерисуется.
    expect(source().at(1)).toBe(neighbour)
    expect(version()).toBeGreaterThan(seen)

    act(() => table.setRowData('r1', { id: 'r1', name: 'Value' }))
    expect(nameAt(1)).toBe('Value')

    // Строка не загружена: ни данных, ни перерисовки.
    seen = version()
    act(() => table.setRowData('r500', { id: 'r500', name: 'Never' }))
    expect(source().at(500)).toBeUndefined()
    expect(version()).toBe(seen)
  })
  it("SD26: pagination, paginationModel, infiniteScroll, rowDragging, rowGrouping, rowGroupingModel и до этапа 5 rowExpanding инертны с причиной 'serverRowModel' и dev-warn", () => {
    const extra = [
      pagination(),
      infiniteScroll({ onLoadMore: () => {} }),
      rowDragging(),
      rowGrouping(),
      rowExpanding(),
    ]
    const ids = [
      'pagination',
      'paginationModel',
      'infiniteScroll',
      'rowDragging',
      'rowGrouping',
      'rowGroupingModel',
      'rowExpanding',
    ]
    const reasons = () =>
      Object.fromEntries(
        (
          table.getPluginDiagnostics() as {
            id: string
            status: string
            reason?: string
          }[]
        )
          .filter(diagnostic => ids.includes(diagnostic.id))
          .map(diagnostic => [diagnostic.id, diagnostic.reason]),
      )
    // Модели без интерфейса — своим набором: интерфейс подключает модель сам.
    const models = [paginationModel(), rowGroupingModel()]
    act(() => root.render(<Grid extra={models} />))
    const fromModels = reasons()
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Grid extra={extra} />))
    expect({ ...fromModels, ...reasons() }).toEqual(
      Object.fromEntries(ids.map(id => [id, 'serverRowModel'])),
    )
    for (const id of ids) {
      expect(
        warnings().some(
          text => text.includes(id) && text.includes('serverRowModel'),
        ),
      ).toBe(true)
    }

    // Без загрузчика строки ведёт клиент — этой причины нет.
    act(() => root.render(<Grid loader={false} extra={extra} />))
    expect(Object.values(reasons())).not.toContain('serverRowModel')
  })
})
