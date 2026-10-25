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
import type { RowLoadError, RowSource, RowWindow } from '../../core/rowSource'
import { BlockStore } from './blockStore'
import type { ServerRowModelHooks, ServerRowsRequest } from './types'
import type { Updater } from '../../types'

export const SERVER_ROW_MODEL = 'serverRowModel'

export const DEFAULT_BLOCK_SIZE = 100
export const DEFAULT_MAX_BLOCKS = 100

type Query = Pick<
  ServerRowsRequest,
  'sorting' | 'columnFilters' | 'globalFilter'
>

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
}

interface SourceRow {
  id: string
}

type Store = BlockStore<unknown, SourceRow, Query>

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

/** Строки, чьи блоки держатся: активная ячейка и строка в правке. */
const pinnedOf = (t: ServerTable, indexOf: (id: string) => number) => {
  const pinned: number[] = []
  const active = t.atoms[pluginStateKey('keyboardNavigation')]?.get() as
    { rowIndex?: number } | undefined
  if (active?.rowIndex !== undefined && active.rowIndex >= 0) {
    pinned.push(active.rowIndex)
  }
  const editing = t.atoms[pluginStateKey('cellEditing')]?.get() as
    { active?: { cell: { rowId: string } } | null } | undefined
  const editedRow = editing?.active?.cell.rowId
  const edited = editedRow === undefined ? -1 : indexOf(editedRow)
  if (edited >= 0) pinned.push(edited)
  return pinned
}

const queryOf = (t: ServerTable): Query => {
  const state = t.store.get()
  return {
    sorting: (state.sorting ?? []) as Query['sorting'],
    columnFilters: (state.columnFilters ?? []) as Query['columnFilters'],
    globalFilter: (state.globalFilter ?? '') as string,
  }
}

const sameQuery = (a: Query, b: Query) =>
  JSON.stringify(a) === JSON.stringify(b)

/** Хранилище одной выборки и ждущие прихода её окна (серверное действие, §6). */
interface Generation {
  store: Store
  query: Query
  waiters: { resolve: () => void; reject: (error: Error) => void }[]
}

const createServerSource = (table: unknown): ServerSource => {
  const t = table as ServerTable
  let version = 0
  // Срез плагина — счётчик изменений: корень грида перерисовывается по нему.
  const changed = () => setPluginState(table, SERVER_ROW_MODEL, ++version)
  let maxBlocks = t.options.serverRowModelMaxBlocks ?? DEFAULT_MAX_BLOCKS
  let suspended = false
  let lastWindow: RowWindow | null = null
  /** Отказ выборки, которую сменило не серверное действие: повтор — плашкой. */
  let queryError: RowLoadError | undefined
  /**
   * Ждущие, чья выборка ещё не дошла до состояния таблицы: срез плагина (ADR 0120)
   * приходит рендером, а действие ждёт сразу.
   */
  let early: Generation['waiters'] = []

  const buildRows = (data: unknown[], start: number) =>
    data.map((original, offset) => {
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
        0,
      ) as unknown as SourceRow
    })

  const createGeneration = (query: Query): Generation => {
    const generation = { query, waiters: [] } as unknown as Generation
    generation.store = new BlockStore<unknown, SourceRow, Query>({
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
        const result = getRows?.({ ...range, ...rowsQuery, signal }) ?? {
          rows: [],
        }
        reportOutcome(table, { ...report, cause }, result)
        return result
      },
      toRows: buildRows,
      idOf: row => row.id,
      onChange: () => {
        if (generation === shown) {
          settleShown()
          changed()
        } else if (generation === next) settleNext()
      },
      // Отказ блока среди загруженных строк объявляется; без них — заглушка ошибки сама.
      onFailure: (_, reason) => {
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
      const row = generation.store.rowAt(index) as
        { original: unknown } | undefined
      if (!row) continue
      const [updated] = buildRows(
        [functionalUpdate(updater, row.original)],
        index,
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
    refresh: options => refresh(!!options?.purge),
    setRowData,
    // Без загруженных строк отказ показывает заглушка (`loadError`), а не строки ошибки.
    failures: () =>
      shown.store.hasLoaded()
        ? shown.store.failures().map(({ index, start, end, reason }) => ({
            start,
            end,
            reason,
            retry: () => shown.store.retry(index),
          }))
        : [],
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
