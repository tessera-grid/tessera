/**
 * Источник строк серверной модели (ADR 0138, §2–§6): хранилище блоков на выборку, строки
 * блока собирает публичная `constructRow` TanStack. Окно и быструю прокрутку сообщает тело
 * (`observe`); блоки активной ячейки и правки не вытесняются. Смена сортировки, фильтров
 * или поиска заводит хранилище новой выборки: прежнее остаётся на экране, пока окно новой
 * не пришло, и при отказе остаётся совсем.
 */
import { constructRow, functionalUpdate } from '@tanstack/react-table'

import { announceLabel } from '../../core/announcer'
import { reportAction, reportOutcome } from '../../core/debugActions'
import { logWarn } from '../../core/logger'
import { pluginStateKey, setPluginState } from '../../core/definePlugin'
import { readPluginHooks } from '../../core/definePlugin/channels'
import {
  GROUP_ROW_PREFIX,
  type RowListChange,
  type RowLoadError,
  type RowSource,
  type RowWindow,
} from '../../core/rowSource'
import { serverAggregationsOf } from '../../core/serverAggregations'
import { isThenable } from '../../core/thenable'
import { BlockTree } from './tree'
import type {
  ServerRowModelHooks,
  ServerRowsRequest,
  ServerRowsResponse,
} from './types'
import type { Updater } from '../../types'

export const SERVER_ROW_MODEL = 'serverRowModel'

export const DEFAULT_BLOCK_SIZE = 100
export const DEFAULT_MAX_BLOCKS = 100
/** Сколько смен раскладки помнит журнал списка. */
const JOURNAL_SIZE = 64

type Query = Pick<
  ServerRowsRequest,
  'sorting' | 'columnFilters' | 'globalFilter' | 'grouping' | 'aggregations'
>

/** Путь значений групп по id строки-группы; у прочих строк — пусто. */
const groupKeysOf = (id: string | undefined): unknown[] =>
  id?.startsWith(GROUP_ROW_PREFIX)
    ? (JSON.parse(id.slice(GROUP_ROW_PREFIX.length)) as unknown[])
    : []

interface ServerColumn {
  id: string
  accessorFn?: (original: unknown, index: number) => unknown
}

interface ServerTable {
  options: {
    getRowId?: (original: unknown, index: number) => unknown
    serverRowModelBlockSize?: number
    serverRowModelMaxBlocks?: number
    serverRowModelRowCount?: number
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

const expandedSets = new WeakMap<object, ReadonlySet<string>>()

/**
 * Раскрытые строки по срезу `expanded`; один набор на значение среза. «Раскрыть всё»
 * (`true`) ветки не раскрывает (ADR 0138, §14).
 */
const expandedSetOf = (
  t: ServerTable,
  none: ReadonlySet<string>,
): ReadonlySet<string> => {
  const value = t.atoms.expanded?.get()
  if (typeof value !== 'object' || value === null) return none
  let set = expandedSets.get(value)
  if (!set) {
    set = new Set(
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
}

const sources = new WeakMap<object, ServerSource>()

/**
 * Строки, чьи блоки держатся: активная ячейка, строка в правке и строки, чьё сохранение в
 * пути, — его итог пишется в кэш (§7).
 */
const pinnedOf = (t: ServerTable, indexOf: (id: string) => number) => {
  const pinned: number[] = []
  const active = t.atoms[pluginStateKey('keyboardNavigation')]?.get() as
    { rowIndex?: number } | undefined
  if (active?.rowIndex !== undefined && active.rowIndex >= 0) {
    pinned.push(active.rowIndex)
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

  /** Строка-группа уровня `depth`: id из пути значений групп (ADR 0144, §2). */
  const buildGroupRow = (
    original: unknown,
    index: number,
    depth: number,
    parentId: string | undefined,
    columnId: string,
  ) => {
    const column = t.getColumn?.(columnId)
    const value = column?.accessorFn
      ? column.accessorFn(original, index)
      : (original as Record<string, unknown> | null)?.[columnId]
    const id =
      GROUP_ROW_PREFIX + JSON.stringify([...groupKeysOf(parentId), value])
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

  const createGeneration = (query: Query): Generation => {
    const generation = { query, waiters: [] } as unknown as Generation
    generation.store = new BlockTree<unknown, SourceRow, Query>({
      blockSize: t.options.serverRowModelBlockSize ?? DEFAULT_BLOCK_SIZE,
      maxBlocks,
      rowCount: t.options.serverRowModelRowCount,
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
      childCount: id => groupChildCount(generation.store.rowById(id)),
      onChange: () => {
        if (generation === shown) {
          settleShown()
          changed()
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

  /** Прежнее хранилище новых блоков не просит, пока окно новой выборки идёт. */
  const observeShown = () => {
    if (!lastWindow) return
    shown.store.setPinned(pinnedOf(t, id => shown.store.indexOf(id)))
    shown.store.setWindow(
      lastWindow.first,
      lastWindow.last,
      lastWindow.fast || !!next,
    )
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
    if (state === 'loaded') {
      shown.store.dispose()
      shown = generation
      for (const waiter of generation.waiters) waiter.resolve()
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
      next.store.setWindow(
        top ? 0 : lastWindow.first,
        top ? lastWindow.last - lastWindow.first : lastWindow.last,
        lastWindow.fast,
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

  /** Новые данные строки — в каждом хранилище, где она загружена. */
  const setRowData = (id: string, updater: Updater<unknown>) => {
    let found = false
    for (const generation of next ? [shown, next] : [shown]) {
      const index = generation.store.indexOf(id)
      const row = generation.store.rowAt(index)
      if (!row) continue
      const [updated] = buildRows(
        [functionalUpdate(updater, row.original)],
        row.index,
        row.depth,
        row.parentId,
        generation.query.grouping,
      )
      generation.store.replaceRow(index, updated!)
      found = true
    }
    if (found) changed()
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
    count: () => (shown.store.failedEmpty() ? 0 : shown.store.count()),
    at: index => shown.store.rowAt(index),
    keyByIndex: true,
    byId: id => shown.store.rowById(id),
    indexOf: id => shown.store.indexOf(id),
    observe: window => {
      lastWindow = window
      observeShown()
      next?.store.setWindow(window.first, window.last, window.fast)
      settleShown()
      settleNext()
    },
    sync: () => {
      sync()
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
    // Без загруженных строк отказ показывает заглушка (`loadError`), а не строки ошибки.
    failures: () => (shown.store.hasLoaded() ? shown.store.failures() : []),
    // Строки дерева (ADR 0138, §14): уровень, место среди соседей и их число.
    treeAria: index => shown.store.ariaAt(index),
    // «Выбрать всё» в дереве — итог корней (§14).
    rootCount: () => shown.store.rootCount(),
    groupChildCount,
    totals: () => shown.totals,
    leafCount: () => shown.leafCount,
    epoch: () => epoch,
    version: () => {
      // Раскладка считается лениво: смены пишутся при её пересчёте.
      shown.store.count()
      return layoutVersion
    },
    changesSince: since => {
      shown.store.count()
      if (since === layoutVersion) return []
      const at = journal.findIndex(entry => entry.version === since + 1)
      return at === -1 ? undefined : journal.slice(at).map(e => e.changes)
    },
    loadRange: (first, last, signal) =>
      shown.store.loadRange(first, last, signal),
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
