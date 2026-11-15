/**
 * Источник строк серверной модели (ADR 0138, §2–§6): хранилище блоков на выборку, строки
 * блока собирает публичная `constructRow` TanStack. Окно и быструю прокрутку сообщает тело
 * (`observe`); блоки активной ячейки и правки не вытесняются. Смена сортировки, фильтров
 * или поиска заводит хранилище новой выборки: прежнее остаётся на экране, пока окно новой
 * не пришло, и при отказе остаётся совсем.
 */
import { constructRow, functionalUpdate } from '@tanstack/react-table'

import { announceLabel } from '../../core/announcer'
import { markLoadAnnounced } from '../../core/cancellation'
import { reportAction, reportOutcome } from '../../core/debugActions'
import { flashOutcome } from '../../core/flashes/flashFeature'
import { logWarn } from '../../util/logger'
import { activePageOf } from '../../core/pagination'
import { knownCount, rowCountOf } from '../../core/dataMode'
import { pluginStateKey, setPluginState } from '../../core/definePlugin'
import { readPluginHooks } from '../../core/definePlugin'
import {
  GROUP_ROW_PREFIX,
  groupKeysOf,
  type BranchArrival,
  type RowListChange,
  type RowLoadError,
  type RowSource,
  type RowWindow,
} from '../../core/rowSource'
import {
  dropRowsIn,
  moveRowIn,
  rowSelectionValueOf,
  setRowSelectionValue,
} from '../../core/rowSelectionAll'
import {
  serverAggregationScopesOf,
  serverAggregationsOf,
} from '../../shared/serverAggregations'
import { isThenable } from '../../util/thenable'
import { BlockTree, type ExpandedRows } from './tree'
import { removeRowDrafts } from '../../core/drafts/drafts'
import { positionOf } from '../../core/rowPosition'
import { isExpandedAll } from '../../core/expandAll'
import type {
  ServerRowModelHooks,
  ServerRowTransaction,
  ServerRowTransactionResult,
  ServerRowsRequest,
  ServerRowsResponse,
} from './types'
import type { Updater } from '../../types'
import { serverRowModelLabels } from './labels'

export const SERVER_ROW_MODEL = 'serverRowModel'

export const DEFAULT_BLOCK_SIZE = 100
export const DEFAULT_MAX_BLOCKS = 100
/** Сколько смен раскладки помнит журнал списка. */
const JOURNAL_SIZE = 64
/** Транзакции фоновой вкладки, где кадров нет, применяются по таймеру. */
const HIDDEN_TAB_FALLBACK_MS = 100

type Query = Pick<
  ServerRowsRequest,
  | 'sorting'
  | 'columnFilters'
  | 'globalFilter'
  | 'grouping'
  | 'aggregations'
  | 'aggregationScopes'
>

interface ServerColumn {
  id: string
  accessorFn?: (original: unknown, index: number) => unknown
}

interface ServerTable {
  options: {
    getRowId?: (original: unknown, index: number) => unknown
    serverRowModelBlockSize?: number
    serverRowModelMaxBlocks?: number
  }
  atoms: Record<string, { get: () => unknown } | undefined>
  store: { get: () => Record<string, unknown> }
  getRowId: (original: unknown, index: number) => string
  getHooks: () => unknown
  getColumn?: (id: string) => ServerColumn | undefined
}

interface SourceRow {
  id: string
  index: number
  depth: number
  parentId?: string
  original: unknown
  groupingColumnId?: string
  groupingValue?: unknown
}

type Store = BlockTree<unknown, SourceRow, Query>

const expandedSets = new WeakMap<object, ExpandedRows>()

/** «Раскрыть всё» без исключений: `expanded: true` (ADR 0160, §1). */
const EXPAND_ALL: ExpandedRows = { all: true, except: new Set() }

/**
 * Раскрытые строки по срезу `expanded`; один объект на значение среза. `true` и
 * `{ all, except }` — «раскрыто всё, кроме» (ADR 0160, §1).
 */
const expandedSetOf = (
  t: ServerTable,
  none: ReadonlySet<string>,
): ExpandedRows => {
  const value = t.atoms.expanded?.get()
  if (value === true) return EXPAND_ALL
  if (typeof value !== 'object' || value === null) return none
  let set = expandedSets.get(value)
  if (!set) {
    set = isExpandedAll(value)
      ? { all: true, except: new Set(value.except) }
      : new Set(
          Object.entries(value as Record<string, boolean>)
            .filter(([, open]) => open)
            .map(([id]) => id),
        )
    expandedSets.set(value, set)
  }
  return set
}

export interface ServerSource extends RowSource<SourceRow> {
  /** Хранилище строк на экране. */
  readonly store: Store
  setMaxBlocks: (maxBlocks: number) => void
  resume: () => void
  suspend: () => void
  /** Перезапросить окно под текущим состоянием (§7). */
  refresh: (options?: { purge?: boolean }) => void
  /** Заменить данные загруженной строки (§7). */
  setRowData: (id: string, updater: Updater<unknown>) => void
  /** Транзакция строк (ADR 0157): применяется задачей после кадра вместе с соседними. */
  applyRowTransaction: (
    transaction: ServerRowTransaction,
  ) => ServerRowTransactionResult
}

const sources = new WeakMap<object, ServerSource>()

/**
 * Строки, чьи блоки держатся: активная ячейка, строка в правке и строки, чьё сохранение в
 * пути, — его итог пишется в кэш (§7).
 */
const pinnedOf = (
  t: ServerTable,
  indexOf: (id: string) => number,
  offset: number,
) => {
  const pinned: number[] = []
  const active = t.atoms[pluginStateKey('keyboardNavigation')]?.get() as
    { rowIndex?: number } | undefined
  // Активная ячейка — в индексах страницы (ADR 0158).
  if (active?.rowIndex !== undefined && active.rowIndex >= 0) {
    pinned.push(offset + active.rowIndex)
  }
  const editing = t.atoms[pluginStateKey('cellEditing')]?.get() as
    | {
        active?: { cell: { rowId: string } } | null
        submitted?: Record<string, { rowId: string; status: string }>
      }
    | undefined
  const rowIds = [
    editing?.active?.cell.rowId,
    ...Object.values(editing?.submitted ?? {})
      .filter(entry => entry.status === 'pending')
      .map(entry => entry.rowId),
  ]
  for (const rowId of rowIds) {
    const index = rowId === undefined ? -1 : indexOf(rowId)
    if (index >= 0) pinned.push(index)
  }
  return pinned
}

const queryOf = (t: ServerTable): Query => {
  const state = t.store.get()
  return {
    sorting: (state.sorting ?? []) as Query['sorting'],
    columnFilters: (state.columnFilters ?? []) as Query['columnFilters'],
    globalFilter: (state.globalFilter ?? '') as string,
    grouping: (state.grouping ?? []) as string[],
    aggregations: serverAggregationsOf(t),
    aggregationScopes: serverAggregationScopesOf(t),
  }
}

const sameQuery = (a: Query, b: Query) =>
  JSON.stringify(a) === JSON.stringify(b)

/** Хранилище одной выборки и ждущие прихода её окна (серверное действие, §6). */
interface Generation {
  store: Store
  query: Query
  /** Итоги и строки данных выборки — из ответа корня (ADR 0144, §4–§5). */
  totals?: Record<string, unknown>
  leafCount?: number
  waiters: { resolve: () => void; reject: (error: Error) => void }[]
}

const createServerSource = (table: unknown): ServerSource => {
  const t = table as ServerTable
  let version = 0
  // Срез плагина — счётчик изменений: корень грида перерисовывается по нему.
  const changed = () => setPluginState(table, SERVER_ROW_MODEL, ++version)
  let maxBlocks = t.options.serverRowModelMaxBlocks ?? DEFAULT_MAX_BLOCKS
  const notExpanded: ReadonlySet<string> = new Set()
  let suspended = false
  let lastWindow: RowWindow | null = null
  /** Отказ выборки, которую сменило не серверное действие: повтор — плашкой. */
  let queryError: RowLoadError | undefined
  /**
   * Ждущие, чья выборка ещё не дошла до состояния таблицы: срез плагина (ADR 0120)
   * приходит рендером, а действие ждёт сразу.
   */
  let early: Generation['waiters'] = []
  /** Новая выборка или сброс кэша (ADR 0146, §6). */
  let epoch = 0
  /** Смены раскладки списка на экране: место и число строк. */
  let layoutVersion = 0
  const journal: { version: number; changes: RowListChange[] }[] = []

  /** Значение группы в данных строки-группы и её id из пути значений (ADR 0144, §2). */
  const groupKeyOf = (
    original: unknown,
    index: number,
    parentId: string | undefined,
    columnId: string,
  ) => {
    const column = t.getColumn?.(columnId)
    const value = column?.accessorFn
      ? column.accessorFn(original, index)
      : (original as Record<string, unknown> | null)?.[columnId]
    const id =
      GROUP_ROW_PREFIX + JSON.stringify([...groupKeysOf(parentId), value])
    return { id, value }
  }

  /** Строка-группа уровня `depth`. */
  const buildGroupRow = (
    original: unknown,
    index: number,
    depth: number,
    parentId: string | undefined,
    columnId: string,
  ) => {
    const { id, value } = groupKeyOf(original, index, parentId, columnId)
    const row = constructRow(
      table as never,
      id,
      original as never,
      index,
      depth,
      undefined,
      parentId,
    ) as unknown as SourceRow
    row.groupingColumnId = columnId
    row.groupingValue = value
    return row
  }

  /** Строки блока ветки `parentId` глубины `depth`; `start` — индекс в ветке. */
  const buildRows = (
    data: unknown[],
    start: number,
    depth = 0,
    parentId?: string,
    grouping: readonly string[] = [],
  ) =>
    data.map((original, offset) => {
      if (depth < grouping.length) {
        return buildGroupRow(
          original,
          start + offset,
          depth,
          parentId,
          grouping[depth]!,
        )
      }
      const id = t.getRowId(original, start + offset)
      // Id по индексу после перезапроса бессмысленны: строке нужен свой (SD13). TanStack
      // сам подставляет индекс, поэтому смотрим ответ `getRowId` приложения.
      if (typeof t.options.getRowId?.(original, start + offset) !== 'string') {
        logWarn(
          table as never,
          'serverRowModel: a row has no string id — pass getRowId to useCreateTable',
          'serverRowModel:noRowId',
        )
      }
      return constructRow(
        table as never,
        id,
        original as never,
        start + offset,
        depth,
        undefined,
        parentId,
      ) as unknown as SourceRow
    })

  /** Строк в группе — из её строки ответа; у строк данных — нет. */
  const groupChildCount = (row: SourceRow | undefined) =>
    row?.groupingColumnId === undefined
      ? undefined
      : readPluginHooks<ServerRowModelHooks>(
          t as never,
          SERVER_ROW_MODEL,
        ).getGroupChildCount?.(row.original)

  /** Подпись группы: строки данных, без них — прямые дети (ADR 0184, §8). */
  const groupRowCount = (row: SourceRow | undefined) =>
    row?.groupingColumnId === undefined
      ? undefined
      : (readPluginHooks<ServerRowModelHooks>(
          t as never,
          SERVER_ROW_MODEL,
        ).getGroupRowCount?.(row.original) ?? groupChildCount(row))

  /** Ветки, которые раскрыл человек: ждут первого ответа (SD55–SD60). */
  const branchWaits = new Map<
    string,
    {
      generation: Generation
      done: (arrival: BranchArrival) => void
      /** Запрос ветки ушёл: его отмена окном или сворачиванием снимает ожидание. */
      asked?: boolean
    }
  >()
  const settleBranchWaits = () => {
    for (const [id, wait] of branchWaits) {
      const answer =
        wait.generation === shown ? shown.store.branchAnswer(id) : 'gone'
      if (answer === undefined) {
        if (shown.store.branchLoading(id)) wait.asked = true
        else if (wait.asked) branchWaits.delete(id)
        continue
      }
      branchWaits.delete(id)
      if (answer !== 'gone') {
        wait.done({
          rowIds: answer.rows.map(row => row.id),
          count: answer.count,
        })
      }
    }
  }

  const createGeneration = (query: Query): Generation => {
    const generation = { query, waiters: [] } as unknown as Generation
    generation.store = new BlockTree<unknown, SourceRow, Query>({
      blockSize: t.options.serverRowModelBlockSize ?? DEFAULT_BLOCK_SIZE,
      maxBlocks,
      // Итог до первого ответа — `rowCount` таблицы (ADR 0169, §4).
      rowCount: knownCount(rowCountOf(t)),
      query: () => query,
      getRows: ({ query: rowsQuery, signal, ...range }) => {
        const { getRows } = readPluginHooks<ServerRowModelHooks>(
          t as never,
          SERVER_ROW_MODEL,
        )
        // Запрос блока и его итог — в канал действий (ADR 0125): ответ, отказ, отмена.
        const report = { plugin: SERVER_ROW_MODEL, action: 'loadBlock' }
        const cause = reportAction(table, {
          ...report,
          detail: range,
          source: 'auto',
        })
        signal.addEventListener(
          'abort',
          () =>
            reportAction(table, {
              ...report,
              action: 'loadBlockCancelled',
              source: 'auto',
              cause,
            }),
          { once: true },
        )
        const result = getRows?.({
          ...range,
          ...rowsQuery,
          groupKeys: groupKeysOf(range.parentId),
          signal,
        }) ?? {
          rows: [],
        }
        reportOutcome(table, { ...report, cause }, result)
        // Итоги выборки — из ответа корня, раньше перерисовки по его приходу.
        const capture = (response: ServerRowsResponse | undefined) => {
          if (!response || range.parentId !== undefined) return
          if (response.totals !== undefined) generation.totals = response.totals
          if (response.leafCount !== undefined) {
            generation.leafCount = response.leafCount
          }
        }
        if (isThenable(result)) result.then(capture, () => {})
        else capture(result)
        return result
      },
      toRows: (data, start, depth, parentId) =>
        buildRows(data, start, depth, parentId, query.grouping),
      idOf: row => row.id,
      expanded: () => expandedSetOf(t, notExpanded),
      canExpand: row =>
        !!(row as { getCanExpand?: () => boolean }).getCanExpand?.(),
      childCount: id => groupChildCount(generation.store.rowById(id)),
      onChange: () => {
        if (generation === shown) {
          settleShown()
          changed()
          settleBranchWaits()
        } else if (generation === next) settleNext()
      },
      onLayoutChange: changes => {
        if (generation !== shown) return
        journal.push({ version: ++layoutVersion, changes })
        if (journal.length > JOURNAL_SIZE) journal.shift()
      },
      // Отказ блока среди загруженных строк объявляется; без них — заглушка ошибки сама.
      onFailure: reason => {
        if (generation !== shown || !shown.store.hasLoaded()) return
        announceLabel(table, labels =>
          reason
            ? `${labels.rowsLoadFailed}. ${reason}`
            : labels.rowsLoadFailed,
        )
      },
    })
    return generation
  }

  let shown = createGeneration(queryOf(t))
  /** Выборка, чьё окно ещё идёт; на экране до его прихода — `shown`. */
  let next: Generation | null = null

  /**
   * Страница списка (ADR 0158, §1): сквозные индексы `[start, end)` — от корня страницы до
   * корня следующей, с раскрытыми ветками; без пагинации — весь список.
   */
  const boundsOf = (store: Store) => {
    const all = store.count()
    const page = activePageOf(table)
    if (!page) return { start: 0, end: all }
    const roots = store.rootCount()
    const first = page.pageIndex * page.pageSize
    return {
      start: first >= roots ? all : store.rootIndex(first),
      end:
        first + page.pageSize >= roots
          ? all
          : store.rootIndex(first + page.pageSize),
    }
  }
  let bounds:
    { layout: object; page: unknown; start: number; end: number } | undefined
  /** Страница на экране: один расчёт на раскладку и срез страницы. */
  const pageBounds = () => {
    const layout = shown.store.layoutKey()
    const page = activePageOf(table)
    if (bounds?.layout !== layout || bounds.page !== page) {
      bounds = { layout, page, ...boundsOf(shown.store) }
    }
    return bounds
  }

  /** Окно тела в индексах страницы — в сквозные индексы хранилища. */
  const listWindow = (store: Store, window: RowWindow) => {
    const { start, end } =
      store === shown.store ? pageBounds() : boundsOf(store)
    return {
      first: start + window.first,
      last: Math.min(start + window.last, end - 1),
    }
  }

  /** Прежнее хранилище новых блоков не просит, пока окно новой выборки идёт. */
  const observeShown = () => {
    if (!lastWindow) return
    shown.store.setPinned(
      pinnedOf(t, id => shown.store.indexOf(id), pageBounds().start),
    )
    const { first, last } = listWindow(shown.store, lastWindow)
    shown.store.setWindow(first, last, lastWindow.fast || !!next)
  }

  /** Окно тела — окну хранилища новой выборки. */
  const observeNext = (window: RowWindow) => {
    if (!next) return
    const { first, last } = listWindow(next.store, window)
    next.store.setWindow(first, last, window.fast)
  }

  /** Выбросить окно новой выборки; ждущие его — тому, что придёт вместо. */
  const dropNext = (): Generation['waiters'] => {
    if (!next) return []
    const { waiters } = next
    next.store.dispose()
    next = null
    return waiters
  }

  /** Окно новой выборки пришло — она на экране; отказало — прежняя остаётся. */
  function settleNext() {
    const generation = next
    if (!generation) return
    const state = generation.store.windowState()
    if (state === 'loading') return
    next = null
    const added = arrivals
    arrivals = []
    if (state === 'loaded') {
      shown.store.dispose()
      shown = generation
      for (const waiter of generation.waiters) waiter.resolve()
      const arrived = added.filter(id => shown.store.indexOf(id) !== -1)
      announceArrivals(arrived, 0)
      if (arrived.length) markLoadAnnounced(table)
    } else {
      generation.store.dispose()
      const error = new Error(state.failed ?? '')
      if (generation.waiters.length > 0) {
        for (const waiter of generation.waiters) waiter.reject(error)
      } else {
        queryError = { reason: state.failed, retry: () => sync(true) }
      }
    }
    observeShown()
    changed()
  }

  /** Окно на экране пришло после сброса (`purge`): ждущие его получают итог. */
  function settleShown() {
    if (shown.waiters.length === 0) return
    const state = shown.store.windowState()
    if (state === 'loading') return
    const waiters = shown.waiters
    shown.waiters = []
    const error = state === 'loaded' ? null : new Error(state.failed ?? '')
    for (const waiter of waiters) {
      if (error) waiter.reject(error)
      else waiter.resolve()
    }
  }

  /** Окно выборки грузится рядом с прежним; `top` — с начала списка. */
  const startNext = (query: Query, top: boolean) => {
    if (top) epoch++
    const waiters = dropNext()
    queryError = undefined
    next = createGeneration(query)
    next.waiters.push(...waiters, ...early)
    early = []
    if (suspended) next.store.suspend()
    if (lastWindow) {
      observeNext(
        top
          ? {
              ...lastWindow,
              first: 0,
              last: lastWindow.last - lastWindow.first,
            }
          : lastWindow,
      )
    }
    observeShown()
    changed()
    return next
  }

  /** Выборка в состоянии таблицы сменилась: окно новой — с начала списка (§6). */
  function sync(retry = false): Generation | null {
    const query = queryOf(t)
    if (next && sameQuery(next.query, query)) return next
    if (!retry && sameQuery(shown.query, query)) {
      if (next) {
        // Выборка вернулась к той, что на экране: ждать нечего.
        for (const waiter of dropNext()) waiter.resolve()
        observeShown()
        changed()
      }
      return null
    }
    return startNext(query, true)
  }

  /**
   * Перезапрос окна (§7): строки на экране до ответа под свечением, с `purge` — сразу
   * скелет. Прочий кэш уходит вместе с прежним хранилищем.
   */
  const refresh = (purge: boolean) => {
    const query = queryOf(t)
    if (!purge) {
      startNext(query, false)
      return
    }
    epoch++
    const waiters = dropNext()
    queryError = undefined
    shown.store.dispose()
    shown = createGeneration(query)
    shown.waiters.push(...waiters, ...early)
    early = []
    if (suspended) shown.store.suspend()
    observeShown()
    changed()
  }

  /**
   * Строка `update` транзакции: по id данных, а данные строки-группы — по пути значений
   * ветки `parentId` (ADR 0159, §5): своего id у них нет.
   */
  const updatedRowId = (data: unknown, parentId: string | undefined) => {
    const id = t.getRowId(data, 0)
    const { grouping } = shown.query
    const level = groupKeysOf(parentId).length
    if (level >= grouping.length || shown.store.indexOf(id) >= 0) return id
    return groupKeyOf(data, 0, parentId, grouping[level]!).id
  }

  /** Новые данные строки — в каждом хранилище, где она загружена. */
  const setRowData = (id: string, updater: Updater<unknown>) => {
    let found = false
    for (const generation of next ? [shown, next] : [shown]) {
      const index = generation.store.indexOf(id)
      const row = generation.store.rowAt(index)
      if (!row) continue
      const [updated] = buildRows(
        [functionalUpdate(updater, row.original)],
        positionOf(row),
        row.depth,
        row.parentId,
        generation.query.grouping,
      )
      generation.store.replaceRow(index, updated!)
      found = true
    }
    if (found) changed()
  }

  /** Добавленные без места (ADR 0157, §1): вспыхивают, когда придёт перезапрошенное окно. */
  let arrivals: string[] = []

  /** Новые строки вспыхивают «пришла» (§4, ADR 0056); одно объявление на пачку (§5). */
  const announceArrivals = (arrived: readonly string[], removed: number) => {
    if (arrived.length) {
      flashOutcome(
        table,
        arrived.map(row => ({ row })),
        'arrived',
      )
    }
    if (arrived.length || removed) {
      announceLabel(table, labels =>
        [
          arrived.length
            ? serverRowModelLabels(labels).announceRowsAdded(arrived.length)
            : '',
          removed
            ? serverRowModelLabels(labels).announceRowsRemoved(removed)
            : '',
        ]
          .filter(Boolean)
          .join('. '),
      )
    }
  }

  /** Транзакции, ждущие кадра (ADR 0157, §5): применяются вместе, одно объявление. */
  let queued: ServerRowTransaction[] = []
  const flushTransactions = () => {
    const batch = queued
    queued = []
    const arrived: string[] = []
    // Строка уже на экране (новая строка под тем же id, ADR 0181) — не «пришла».
    const source = (
      table as { getRowSource?: () => { byId: (id: string) => unknown } }
    ).getRowSource?.()
    const shownBefore = new Set(
      batch
        .flatMap(transaction => transaction.add ?? [])
        .map(data => t.getRowId(data, 0))
        .filter(id => !!source?.byId(id)),
    )
    let removed = 0
    const gone = new Set<string>()
    for (const transaction of batch) {
      for (const id of transaction.remove ?? []) gone.add(id)
      const result = shown.store.applyTransaction({
        parentId: transaction.parentId,
        add: transaction.add?.length
          ? { data: transaction.add, index: transaction.index! }
          : undefined,
        remove: transaction.remove,
        rowCount: transaction.rowCount,
      })
      if (result === 'branchNotLoaded') continue
      for (const data of transaction.add ?? []) {
        const id = t.getRowId(data, 0)
        if (!shownBefore.has(id)) arrived.push(id)
      }
      // Итог задан приложением — удалены и незагруженные строки.
      removed +=
        transaction.rowCount === undefined
          ? result.removed
          : (transaction.remove?.length ?? 0)
    }
    // Удалённые строки выпадают из выбора (§3).
    const selection = rowSelectionValueOf(table)
    const kept = dropRowsIn(selection, gone)
    if (kept !== selection) setRowSelectionValue(table, kept)
    // Строка, добавленная той же пачкой, осталась в списке: её черновики живут (ADR 0178).
    for (const transaction of batch) {
      for (const data of transaction.add ?? []) gone.delete(t.getRowId(data, 0))
    }
    removeRowDrafts(table, gone)
    announceArrivals(arrived, removed)
  }
  const scheduleTransactions = () => {
    let frame: number | undefined
    let afterFrame: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      clearTimeout(timer)
      clearTimeout(afterFrame)
      flushTransactions()
    }
    const timer = setTimeout(run, HIDDEN_TAB_FALLBACK_MS)
    if (typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(() => {
        frame = undefined
        afterFrame = setTimeout(run, 0)
      })
    }
  }

  const applyRowTransaction = (
    transaction: ServerRowTransaction,
  ): ServerRowTransactionResult => {
    reportAction(table, {
      plugin: SERVER_ROW_MODEL,
      action: 'rowTransaction',
      detail: {
        add: transaction.add?.length ?? 0,
        update: transaction.update?.length ?? 0,
        remove: transaction.remove?.length ?? 0,
      },
      source: 'api',
    })
    for (const data of transaction.update ?? []) {
      setRowData(updatedRowId(data, transaction.parentId), () => data)
    }
    // Место новой строки знает только сервер: окно перезапрашивается тихо (§1).
    if (transaction.add?.length && transaction.index === undefined) {
      refresh(false)
      for (const data of transaction.add) arrivals.push(t.getRowId(data, 0))
      return 'refetch'
    }
    if (
      (transaction.add?.length || transaction.rowCount !== undefined) &&
      !shown.store.hasBranch(transaction.parentId)
    ) {
      return 'branchNotLoaded'
    }
    if (!transaction.add?.length && !transaction.remove?.length) {
      if (transaction.rowCount === undefined) return 'applied'
    }
    if (queued.length === 0) scheduleTransactions()
    queued.push(transaction)
    return 'applied'
  }

  /**
   * Другая страница — другой список для следящих за строками: журнал её не связывает с
   * прежней (ADR 0158), раскладка — новая.
   */
  let seenPage: unknown = activePageOf(table)
  /** Начало страницы на каждой раскладке, которую видели следящие. */
  const offsets = new Map<number, number>()
  const checkPage = () => {
    const page = activePageOf(table)
    if (page === seenPage) return
    seenPage = page
    layoutVersion++
    journal.length = 0
    offsets.clear()
  }
  const currentVersion = () => {
    // Раскладка считается лениво: смены пишутся при её пересчёте.
    const { start } = pageBounds()
    checkPage()
    if (!offsets.has(layoutVersion)) {
      offsets.set(layoutVersion, start)
      if (offsets.size > JOURNAL_SIZE + 1) {
        offsets.delete(offsets.keys().next().value!)
      }
    }
    return layoutVersion
  }

  // Отказ списка — тот же объект, пока данные хранилища не менялись.
  let listError: { version: number; value: RowLoadError | undefined } = {
    version: -1,
    value: undefined,
  }
  return {
    get store() {
      return shown.store
    },
    // Отказ списка целиком — строк для тела нет: заглушка встаёт вместо него.
    count: () => {
      if (shown.store.failedEmpty()) return 0
      const { start, end } = pageBounds()
      return end - start
    },
    at: index => {
      const { start, end } = pageBounds()
      return index < 0 || start + index >= end
        ? undefined
        : shown.store.rowAt(start + index)
    },
    keyByIndex: true,
    branchLoading: id => shown.store.branchLoading(id),
    cancelBranch: id => shown.store.cancelBranch(id),
    whenBranchArrives: (id, done) => {
      if (!shown.store.branchCached(id)) {
        branchWaits.set(id, { generation: shown, done })
      }
    },
    byId: id => shown.store.rowById(id),
    indexOf: id => {
      const index = shown.store.indexOf(id)
      const { start, end } = pageBounds()
      return index < start || index >= end ? -1 : index - start
    },
    listIndexOf: id => shown.store.indexOf(id),
    loadedRows: () => shown.store.loadedRows(),
    branchSize: parentId => shown.store.branchSize(parentId),
    rowIn: (parentId, index) => shown.store.rowIn(parentId, index),
    // Перенос — транзакция строк (ADR 0157): удаление и вставка одной пачкой, итог тот же.
    moveRow: (id, { parentId, index }, stray) => {
      const row = shown.store.rowById(id)
      if (!row && !stray) return false
      const from = shown.store.ancestorsOf(id)
      // Строки уже нет в кэше (ушла за окно): её место закрывается, встаёт она по данным.
      if (!row) shown.store.closePlace(stray!.from.parentId, stray!.from.index)
      const result = shown.store.applyTransaction(
        row
          ? { parentId, remove: [id], add: { data: [row.original], index } }
          : { parentId, add: { data: [stray!.original], index } },
      )
      if (result === 'branchNotLoaded') return false
      // Выбор строки и её ветки идёт за ней (ADR 0162, §4).
      const selection = rowSelectionValueOf(table)
      const moved = moveRowIn(selection, id, from, shown.store.ancestorsOf(id))
      if (moved !== selection) setRowSelectionValue(table, moved)
      return true
    },
    offset: () => pageBounds().start,
    pageOf: listIndex => {
      const page = activePageOf(table)
      const root = page ? shown.store.rootOf(listIndex) : -1
      return root < 0 ? undefined : Math.floor(root / page!.pageSize)
    },
    rootCountKnown: () => shown.store.isRootCountKnown(),
    observe: window => {
      lastWindow = window
      observeShown()
      observeNext(window)
      settleShown()
      settleNext()
    },
    sync: () => {
      const pending = next
      const generation = sync()
      return generation !== null && generation !== pending
    },
    whenLoaded: () =>
      new Promise<void>((resolve, reject) => {
        const generation = sync()
        if (generation) {
          generation.waiters.push({ resolve, reject })
          return
        }
        early.push({ resolve, reject })
        // Выборка так и не сменилась — ждать нечего.
        setTimeout(() => {
          if (early.length === 0) return
          const late = sync()
          if (late) return
          for (const waiter of early) waiter.resolve()
          early = []
        })
      }),
    refreshing: () => next !== null,
    // Отказ списка — строк нет; итог неизвестен, пока не пришёл короткий блок (§5).
    total: () =>
      shown.store.failedEmpty()
        ? 0
        : shown.store.isTotalKnown()
          ? shown.store.count()
          : -1,
    refresh: options => refresh(!!options?.purge),
    setRowData,
    applyRowTransaction,
    // Без загруженных строк отказ показывает заглушка (`loadError`), а не строки ошибки.
    failures: () => {
      if (!shown.store.hasLoaded()) return []
      const { start, end } = pageBounds()
      return shown.store
        .failures()
        .filter(failure => failure.end > start && failure.start < end)
        .map(failure => ({
          ...failure,
          start: Math.max(failure.start, start) - start,
          end: Math.min(failure.end, end) - start,
        }))
    },
    // Строки дерева (ADR 0138, §14): уровень, место среди соседей и их число.
    treeAria: index => {
      const { start, end } = pageBounds()
      return start + index < end ? shown.store.ariaAt(start + index) : undefined
    },
    // Выбор вложенных строк (ADR 0162): путь строки и размеры веток.
    ancestors: id => shown.store.ancestorsOf(id),
    subtreeSize: parentId => shown.store.subtreeSize(parentId),
    // Линии дерева (ADR 0161): за концом страницы детей нет.
    treeLines: index => {
      const { start, end } = pageBounds()
      if (start + index >= end) return undefined
      const lines = shown.store.linesAt(start + index)
      return lines && start + index + 1 >= end
        ? { ...lines, open: false }
        : lines
    },
    // «Выбрать всё» в дереве — итог корней (§14).
    rootCount: () => shown.store.rootCount(),
    groupChildCount,
    groupRowCount,
    totals: () => shown.totals,
    leafCount: () => shown.leafCount,
    epoch: () => epoch,
    version: currentVersion,
    // Смены — в индексах страницы: сквозные индексы сдвинуты на её начало до и после.
    changesSince: since => {
      const version = currentVersion()
      if (since === version) return []
      const at = journal.findIndex(entry => entry.version === since + 1)
      const before = offsets.get(since)
      if (at === -1 || before === undefined) return undefined
      const after = offsets.get(version)!
      const batches = journal.slice(at).map(e => e.changes)
      return [
        ...(before ? [[{ at: 0, delta: before }]] : []),
        ...batches,
        ...(after ? [[{ at: 0, delta: -after }]] : []),
      ]
    },
    loadList: (limit, signal) => shown.store.loadList(limit, signal),
    pageRootIndexes: () => {
      const { start, end } = pageBounds()
      const store = shown.store
      const page = activePageOf(table)
      const roots = store.rootCount()
      const first = page ? page.pageIndex * page.pageSize : 0
      const count = page ? Math.min(page.pageSize, roots - first) : roots
      const indexes: number[] = []
      for (let local = first; local < first + count; local++) {
        const index = store.rootIndex(local)
        if (index < end) indexes.push(index - start)
      }
      return indexes
    },
    loadRange: (first, last, signal) => {
      const { start } = pageBounds()
      return shown.store.loadRange(start + first, start + last, signal)
    },
    loadError: () => {
      if (queryError) return queryError
      if (listError.version !== version) {
        const [first] = shown.store.hasLoaded() ? [] : shown.store.failures()
        listError = {
          version,
          value: first && {
            reason: first.reason,
            retry: () => shown.store.retryAll(),
          },
        }
      }
      return listError.value
    },
    setMaxBlocks: value => {
      maxBlocks = value
      shown.store.setMaxBlocks(value)
      next?.store.setMaxBlocks(value)
    },
    resume: () => {
      suspended = false
      shown.store.resume()
      next?.store.resume()
    },
    suspend: () => {
      suspended = true
      shown.store.suspend()
      next?.store.suspend()
    },
  }
}

/** Источник таблицы: создаётся при первом обращении и живёт с таблицей. */
export const serverSourceOf = (table: unknown): ServerSource => {
  // Ключ — общий store: React-адаптер отдаёт гриду другой объект таблицы, чем шапке и
  // ячейкам, а источник у таблицы один.
  const key = (table as { store?: object }).store ?? (table as object)
  let source = sources.get(key)
  if (!source) {
    source = createServerSource(table)
    sources.set(key, source)
  }
  return source
}
