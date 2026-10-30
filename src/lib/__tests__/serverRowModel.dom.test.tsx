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
import { rowSelectionValueOf } from '../core/rowSelectionAll'
import { resolveAxes } from '../plugins/dataExportModel/settings'
import { useCreateTable } from '../core/useCreateTable'
import {
  cellEditing,
  columnFilteringModel,
  columnSortingModel,
  dataExport,
  type ExportRequest,
  infiniteScroll,
  keyboardNavigation,
  pagination,
  paginationModel,
  quickSearchModel,
  rowDragging,
  rowExpanding,
  rowGroupingModel,
  rowSelection,
  serverRowModel,
  treeLines,
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
/** Ответить строками диапазона; `count` — итог ветки или списка, если он известен. */
const answer = async (call = calls.at(-1)!, count?: number) => {
  const { start, end, parentId } = call.request
  const last = count === undefined ? end : Math.min(end, count)
  // Дети строки — `<родитель>.<номер>`.
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
  it("SD26: infiniteScroll, rowGroupingModel и rowDragging инертны с причиной 'serverRowModel' и dev-warn; pagination и paginationModel активны", () => {
    const extra = [
      pagination(),
      infiniteScroll({ onLoadMore: () => {} }),
      rowDragging(),
    ]
    const ids = ['infiniteScroll', 'rowDragging', 'rowGroupingModel']
    // Страницы режет серверная модель (ADR 0158): пагинация — без причины.
    const paged = ['pagination', 'paginationModel']
    const reasons = () =>
      Object.fromEntries(
        (
          table.getPluginDiagnostics() as {
            id: string
            status: string
            reason?: string
          }[]
        )
          .filter(diagnostic => [...ids, ...paged].includes(diagnostic.id))
          .map(diagnostic => [
            diagnostic.id,
            diagnostic.reason ?? diagnostic.status,
          ]),
      )
    // Модели без интерфейса — своим набором: интерфейс подключает модель сам.
    const models = [paginationModel(), rowGroupingModel()]
    act(() => root.render(<Grid extra={models} />))
    const fromModels = reasons()
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Grid extra={extra} />))
    expect({ ...fromModels, ...reasons() }).toEqual({
      ...Object.fromEntries(ids.map(id => [id, 'serverRowModel'])),
      ...Object.fromEntries(paged.map(id => [id, 'active'])),
    })
    for (const id of ids) {
      expect(
        warnings().some(
          text => text.includes(id) && text.includes('serverRowModel'),
        ),
      ).toBe(true)
    }
    for (const id of paged) {
      expect(warnings().some(text => text.includes(`${id} инертен`))).toBe(
        false,
      )
    }

    // Без загрузчика строки ведёт клиент — этой причины нет.
    act(() => root.render(<Grid loader={false} extra={extra} />))
    expect(Object.values(reasons())).not.toContain('serverRowModel')
  })
  it('SD29: выбор переживает смену окна, вытеснение блоков и смену сортировки, фильтра и поиска', async () => {
    const extra = [
      rowSelection(),
      columnSortingModel(),
      columnFilteringModel(),
      quickSearchModel(),
    ]
    act(() => root.render(<Grid extra={extra} />))
    const selectedAt = (index: number) =>
      (
        source().at(index) as unknown as { getIsSelected: () => boolean }
      ).getIsSelected()
    /** Окно в начале списка, его блок пришёл. */
    const atStart = async () => {
      show(0, 9)
      const call = calls.at(-1)!
      if (call.request.start === 0 && !answered.has(call)) await answer(call)
    }
    const answered = new Set<Call>()
    const answerAll = async () => {
      for (const call of calls) {
        if (answered.has(call) || call.request.signal.aborted) continue
        answered.add(call)
        await answer(call)
      }
    }
    /** Окно уходит далеко и возвращается: блок начала вытеснен (предел — два блока). */
    const evictAndReturn = async () => {
      for (const start of [100, 200, 300]) {
        show(start, start + 9)
        await answerAll()
      }
      expect(loaded(1)).toBe(false)
      show(0, 9)
      await answerAll()
    }
    /** Новая выборка: окно начала приходит заново. */
    const requery = async (change: () => void) => {
      act(change)
      act(() => source().sync!())
      show(0, 9)
      await answerAll()
    }

    for (const selection of [
      { r1: true },
      { all: true as const, except: ['r2'] },
    ]) {
      await atStart()
      await answerAll()
      act(() => table.setRowSelection(() => selection))
      // Строка 1 выбрана, строка 2 — нет (в «всё, кроме» она исключение).
      const check = () => {
        expect(rowSelectionValueOf(table)).toEqual(selection)
        expect(selectedAt(1)).toBe(true)
        expect(selectedAt(2)).toBe(false)
      }
      check()
      await evictAndReturn()
      check()
      await requery(() => table.setSorting([{ id: 'name', desc: true }]))
      check()
      await requery(() =>
        table.setColumnFilters([
          { id: 'name', value: { operator: 'contains', value: 'N' } },
        ]),
      )
      check()
      await requery(() => table.setGlobalFilter('N'))
      check()
    }
  })

  it('SD30: выгрузка в SSRM — серверная, onExport получает состояние запроса и выбора; без server: true — dev-warn, значения all, view, selected недоступны с причиной', async () => {
    const exports: ExportRequest[] = []
    act(() =>
      root.render(
        <Grid
          extra={[
            rowSelection(),
            columnSortingModel(),
            dataExport({
              server: true,
              onExport: request => {
                exports.push(request)
              },
            }),
          ]}
        />,
      ),
    )
    show(0, 9)
    await answer()
    act(() => table.setSorting([{ id: 'name', desc: true }]))
    act(() => table.setRowSelection(() => ({ all: true, except: ['r3'] })))
    await act(() => table.exportData({ rows: 'selected' }))
    expect(exports).toHaveLength(1)
    expect(exports[0]!.query).toEqual({
      sorting: [{ id: 'name', desc: true }],
      columnFilters: [],
      globalFilter: '',
      grouping: [],
      aggregations: {},
    })
    expect(exports[0]!.selection).toEqual({ all: true, except: ['r3'] })

    // Без серверной выгрузки строк у грида нет: значения строк недоступны с причиной.
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    act(() =>
      root.render(
        <Grid
          extra={[
            rowSelection(),
            columnSortingModel(),
            columnFilteringModel(),
            dataExport(),
          ]}
        />,
      ),
    )
    const rows = resolveAxes(table)!.rows
    expect(rows.map(choice => choice.value)).toEqual([
      'all',
      'view',
      'selected',
    ])
    for (const choice of rows) {
      expect(choice).toMatchObject({ disabled: true, reason: 'serverRowModel' })
    }
    expect(table.getPluginDiagnostics()).toContainEqual({
      id: 'dataExport',
      status: 'inert',
      reason: 'serverRowModel',
    })
    expect(
      warnings().some(
        text => text.includes('dataExport') && text.includes('serverRowModel'),
      ),
    ).toBe(true)
  })
  describe('ленивые дети (этап 5)', () => {
    const tree = (maxBlocks: number, more: unknown[] = []) =>
      act(() =>
        root.render(
          <Grid
            maxBlocks={maxBlocks}
            extra={[
              rowExpanding({ hasChildren: row => row.depth === 0 }),
              ...more,
            ]}
          />,
        ),
      )
    /**
     * Раскрыть или свернуть ветки и прочесть число строк, как тело на перерисовке; дерево
     * перекладывает окно микрозадачей.
     */
    const expand = async (expanded: Record<string, boolean>) => {
      act(() => table.setExpanded(expanded))
      source().count()
      await act(async () => {})
    }
    const branchCalls = (parentId: string) =>
      calls.filter(call => call.request.parentId === parentId)

    it('SD36: свёрнутая строка отдаёт блоки детей вытеснению первыми, раньше блоков на экране; повторное раскрытие запрашивает только недостающие', async () => {
      tree(3)
      show(0, 9)
      await answer()
      await expand({ r1: true })
      await answer(branchCalls('r1')[0], 5)
      expect(source().at(2)?.id).toBe('r1.0')

      // Свернули и раскрыли без нехватки места — блок ветки в кэше, запроса нет.
      await expand({})
      await expand({ r1: true })
      expect(branchCalls('r1')).toHaveLength(1)
      expect(source().at(2)?.id).toBe('r1.0')

      // В окне только дети — блок ветки свежее блока корней; дальше — блок корней 100.
      show(3, 5)
      show(105, 114)
      await answer()
      // Свернули: окну нужен ещё блок корней, четвёртый при пределе в три. Уходит блок
      // свёрнутой ветки, хотя давний блок корней старше.
      await expand({})
      await answer()
      expect(source().at(110)?.id).toBe('r110')
      expect(loaded(0)).toBe(true)
      show(0, 9)
      await expand({ r1: true })
      expect(branchCalls('r1')).toHaveLength(2)
      expect(
        calls.filter(
          call => !call.request.parentId && call.request.start === 0,
        ),
      ).toHaveLength(1)
    })

    it('SD41: предел maxBlocks — общий для корней и всех веток', async () => {
      tree(2)
      show(0, 9)
      await answer()
      await expand({ r1: true })
      await answer(branchCalls('r1')[0], 5)
      // Блок корней и блок ветки — ровно предел.
      expect(loaded(0)).toBe(true)
      expect(source().at(2)?.id).toBe('r1.0')
      // Корень 100 стоит после пяти детей строки 1: третий блок вытесняет давний блок корней.
      show(105, 114)
      await answer()
      expect(source().at(105)?.id).toBe('r100')
      expect(loaded(0)).toBe(false)
      expect(source().at(2)?.id).toBe('r1.0')
    })

    it('SD42: смена сортировки, фильтра или поиска сбрасывает корни и ветки, срез expanded сохраняется; дети раскрытых строк запрашиваются заново, когда ветка в окне', async () => {
      tree(10, [
        columnSortingModel(),
        columnFilteringModel(),
        quickSearchModel(),
      ])
      show(0, 9)
      await answer()
      await expand({ r1: true })
      await answer(branchCalls('r1')[0], 5)

      const requery = async (
        change: () => void,
        matches: (request: ServerRowsRequest) => boolean,
      ) => {
        const before = calls.length
        act(change)
        act(() => source().sync!())
        show(0, 9)
        const rootCall = calls
          .slice(before)
          .find(call => !call.request.parentId)!
        expect(matches(rootCall.request)).toBe(true)
        await answer(rootCall)
        await act(async () => {})
        // Ветка запрошена заново под новой выборкой, раскрытие на месте.
        const childCall = calls
          .slice(before)
          .find(call => call.request.parentId === 'r1')!
        expect(matches(childCall.request)).toBe(true)
        expect(table.atoms.expanded.get()).toEqual({ r1: true })
        await answer(childCall, 3)
        expect(source().at(2)?.id).toBe('r1.0')
        expect(source().at(5)?.id).toBe('r2')
      }
      await requery(
        () => table.setSorting([{ id: 'name', desc: true }]),
        request => request.sorting.length === 1,
      )
      await requery(
        () =>
          table.setColumnFilters([
            { id: 'name', value: { operator: 'contains', value: 'N' } },
          ]),
        request => request.columnFilters.length === 1,
      )
      await requery(
        () => table.setGlobalFilter('N'),
        request => request.globalFilter === 'N',
      )
    })

    it("SD44: treeLines инертен в SSRM с причиной 'serverRowModel' и dev-warn", () => {
      tree(10, [treeLines()])
      expect(table.getPluginDiagnostics()).toContainEqual({
        id: 'treeLines',
        status: 'inert',
        reason: 'serverRowModel',
      })
      expect(
        warnings().some(
          text => text.includes('treeLines') && text.includes('serverRowModel'),
        ),
      ).toBe(true)
    })
  })
})
