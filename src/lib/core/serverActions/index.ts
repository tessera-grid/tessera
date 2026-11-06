/**
 * Серверные действия (ADR 0116): сортировка, фильтры, поиск и страница серверного
 * режима задают один запрос данных. Колбэк действия получает `signal`; промис —
 * ожидание; отказ откатывает сортировку и страницу к состоянию до первого действия
 * цепочки ожидания. Общий модуль четырёх плагинов — вне их папок (IV3).
 */
import { announceLabel, announcerLabels } from '../announcer'
import {
  type CancelSource,
  cancelSourceOf,
  lateAnswer,
  markLoadCancelled,
  registerPending,
} from '../cancellation'
import { dataModeOf } from '../dataMode'
import { reportAction } from '../debugActions'
import { reportFailure, resolveFailure } from '../failures/failuresFeature'
import type { TableLabels } from '../localization'
import { ENGLISH_LABELS } from '../localization/resolveLabels'
import { serverRowModelReason } from '../pluginDiagnostics'
import type { RowSource } from '../rowSource'
import {
  rowSelectionValueOf,
  setRowSelectionValue,
  type RowSelectionValue,
} from '../rowSelectionAll'
import { isThenable, rejectionText } from '../../util/thenable'
import { serverActionReason } from './reason'
import {
  readServerAction,
  type ServerActionCause,
  type ServerActionKind,
  writeServerAction,
} from './serverActionFeature'

export {
  readServerAction,
  serverActionFeature,
  type ServerActionCause,
  type ServerActionKind,
  type ServerActionStatus,
  writeServerAction,
} from './serverActionFeature'
export { serverActionReason } from './reason'
export {
  pendingAttributes,
  type ServerActionMarks,
  useServerActionMarks,
} from './useServerActionMarks'

/** Контекст колбэка серверного действия. */
export interface ServerActionContext {
  /** Прерывается следующим серверным действием и размонтированием грида. */
  signal: AbortSignal
}

/** Результат колбэка: промис — запрос данных под новое состояние. */
export type ServerActionResult = void | PromiseLike<unknown>

interface Snapshot {
  sorting?: unknown
  grouping?: unknown
  /** Выбор — откатывается вместе с группировкой, которая его сбросила (ADR 0148, §4). */
  rowSelection?: RowSelectionValue
  pagination?: { pageIndex: number; pageSize: number }
  /** Фильтры и поиск — их возвращает только отмена (ADR 0153, §4): отказ держит черновик полей. */
  columnFilters?: unknown
  globalFilter?: unknown
}

interface Chain {
  controller: AbortController
  /** Отмена человеком или приложением (ADR 0153). */
  cancel: (source: CancelSource) => void
  /** Снять с учёта реестра ждущих операций. */
  unregister: () => void
  attempt: number
  /** Сортировка и страница до первого действия цепочки — цель отката. */
  confirmed: Snapshot
  kind: ServerActionKind
  /** Номер запроса в канале действий — `cause` его итогов. */
  request: number | undefined
}

interface ServerTable {
  store: object
  atoms: {
    sorting?: {
      get: () => unknown
      subscribe: (listener: (value: unknown) => void) => {
        unsubscribe: () => void
      }
    }
    pagination?: { get: () => Snapshot['pagination'] }
    grouping?: { get: () => unknown }
    rowSelection?: { get: () => unknown }
    columnFilters?: { get: () => unknown }
    globalFilter?: { get: () => unknown }
  }
  setColumnFilters?: (filters: never) => void
  setGlobalFilter?: (value: never) => void
  setSorting?: (sorting: never) => void
  setGrouping?: (grouping: never) => void
  resetExpanded?: (defaultState?: boolean) => void
  setPagination?: (pagination: never) => void
}

// Ключ — общий store: React-адаптер отдаёт гриду другой объект таблицы, чем ячейкам.
const chains = new WeakMap<object, Chain>()
const revertPolicies = new WeakMap<object, Map<RevertedSlice, boolean>>()

/** Срез, который откат возвращает к состоянию до цепочки. */
export type RevertedSlice = 'sorting' | 'pagination'

/**
 * Политика отката среза при отказе (ADR 0167, §3): плагин объявляет её в `setup`, отдаёт
 * результат как cleanup. Без объявления срез откатывается.
 */
export const declareRevertOnReject = (
  table: unknown,
  slice: RevertedSlice,
  revertOnReject: boolean,
) => {
  const { store } = table as { store: object }
  const policies = revertPolicies.get(store) ?? new Map()
  revertPolicies.set(store, policies)
  policies.set(slice, revertOnReject)
  return () => {
    policies.delete(slice)
  }
}

const revertsOnReject = (t: ServerTable, slice: RevertedSlice) =>
  revertPolicies.get(t.store)?.get(slice) !== false

/** Срезы отказавшего запроса и подтверждённые до него. */
export interface RejectedSlices {
  attempted: { columnFilters?: unknown; globalFilter?: unknown }
  confirmed: { columnFilters?: unknown; globalFilter?: unknown }
}

const rejectHandlers = new WeakMap<
  object,
  Map<ServerActionKind, (slices: RejectedSlices) => void>
>()

/**
 * Плагин принимает отказ своего действия сам (ADR 0178, §2): фильтр колонки возвращает срез к
 * подтверждённому и кладёт отказанное условие черновиком. Объявляется в `setup`.
 */
export const declareRejectHandler = (
  table: unknown,
  kind: ServerActionKind,
  handler: (slices: RejectedSlices) => void,
) => {
  const { store } = table as { store: object }
  const handlers = rejectHandlers.get(store) ?? new Map()
  rejectHandlers.set(store, handlers)
  handlers.set(kind, handler)
  return () => {
    if (handlers.get(kind) === handler) handlers.delete(kind)
  }
}
let lastAttempt = 0

let neverAborted: AbortSignal | undefined

/** Серверная модель строк: выборку ведёт её источник (ADR 0138, §6). */
const sourceLoad = (table: unknown, kind: ServerActionKind) =>
  kind === 'pagination'
    ? undefined
    : (table as { getRowSource?: () => RowSource }).getRowSource?.().whenLoaded

const isServer = (t: ServerTable, kind: ServerActionKind) => {
  if (sourceLoad(t, kind)) return true
  switch (kind) {
    // Страницы серверной модели строк — из её кэша, ждать нечего (ADR 0158).
    case 'pagination':
      return dataModeOf(t, kind) === 'server' && !serverRowModelReason(t)
    // Группирует сервер только в серверной модели строк (ADR 0144).
    case 'grouping':
    case 'copy':
    case 'selectPage':
      return false
    default:
      return dataModeOf(t, kind) === 'server'
  }
}

/** Срез действия считает сервер: серверный режим плагина или серверная модель строк. */
export const isServerAction = (table: unknown, kind: ServerActionKind) =>
  isServer(table as ServerTable, kind)

const snapshotOf = (t: ServerTable): Snapshot => ({
  sorting: t.atoms.sorting?.get(),
  grouping: t.atoms.grouping?.get(),
  rowSelection: t.atoms.rowSelection ? rowSelectionValueOf(t) : undefined,
  pagination: t.atoms.pagination?.get(),
  columnFilters: t.atoms.columnFilters?.get(),
  globalFilter: t.atoms.globalFilter?.get(),
})

const samePage = (a: Snapshot['pagination'], b: Snapshot['pagination']) =>
  a?.pageIndex === b?.pageIndex && a?.pageSize === b?.pageSize

type Sorting = readonly { id: string; desc: boolean }[]

const sameGrouping = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? [])

/**
 * Срез группировки к снимку: id групп другой группировки не совпадают — раскрытие сброшено,
 * выбор — тот, что был при этой группировке (ADR 0148, §4).
 */
const setGroupingTo = (
  t: ServerTable,
  { grouping, rowSelection }: Snapshot,
) => {
  if (
    grouping === undefined ||
    sameGrouping(t.atoms.grouping?.get(), grouping)
  ) {
    return
  }
  t.setGrouping?.(grouping as never)
  t.resetExpanded?.(true)
  if (rowSelection !== undefined) setRowSelectionValue(t, rowSelection)
}

const sameSorting = (a: unknown, b: unknown) => {
  const x = (a ?? []) as Sorting
  const y = (b ?? []) as Sorting
  return (
    x.length === y.length &&
    x.every((entry, index) => {
      const other = y[index]
      return entry.id === other.id && entry.desc === other.desc
    })
  )
}

// Возврат страницы, ждущий отката суженной сортировки; снимается следующим действием.
const pageRestores = new WeakMap<object, () => void>()

const cancelPageRestore = (store: object) => {
  pageRestores.get(store)?.()
  pageRestores.delete(store)
}

/**
 * Откат к состоянию до цепочки; колбэки действий он не зовёт (как PG6). Отмена (`force`)
 * откатывает и при `revertOnReject: false`.
 */
const revert = (t: ServerTable, snapshot: Snapshot, force = false) => {
  const { sorting, pagination } = snapshot
  const { atoms, store } = t
  setGroupingTo(t, snapshot)
  const restorePage = () => {
    if (
      (force || revertsOnReject(t, 'pagination')) &&
      pagination !== undefined &&
      !samePage(atoms.pagination?.get(), pagination)
    ) {
      t.setPagination?.(pagination as never)
    }
  }
  // Сортировка первой: при клиентской пагинации её смена сбрасывает страницу.
  if (
    (force || revertsOnReject(t, 'sorting')) &&
    sorting !== undefined &&
    atoms.sorting &&
    !sameSorting(atoms.sorting.get(), sorting)
  ) {
    t.setSorting?.(sorting as never)
    // Суженный срез (ADR 0039) доходит до TanStack рендером, и сброс страницы случится
    // тогда же — страница возвращается после него.
    if (!sameSorting(atoms.sorting.get(), sorting)) {
      const subscription = atoms.sorting.subscribe(next => {
        if (!sameSorting(next, sorting)) return
        cancelPageRestore(store)
        queueMicrotask(restorePage)
      })
      pageRestores.set(store, () => subscription.unsubscribe())
      return
    }
  }
  restorePage()
}

/** Фильтры и поиск — к снимку: поле поиска переносит прежний запрос из среза. */
const restoreFilters = (
  t: ServerTable,
  { columnFilters, globalFilter }: Snapshot,
) => {
  if (
    t.atoms.columnFilters &&
    JSON.stringify(t.atoms.columnFilters.get() ?? []) !==
      JSON.stringify(columnFilters ?? [])
  ) {
    t.setColumnFilters?.((columnFilters ?? []) as never)
  }
  if (t.atoms.globalFilter && t.atoms.globalFilter.get() !== globalFilter) {
    t.setGlobalFilter?.(globalFilter as never)
  }
}

/** Имя серверного действия — в объявлении отмены (ADR 0153, §8). */
export const serverActionName = (
  kind: ServerActionKind,
  labels: TableLabels,
): string => {
  switch (kind) {
    case 'sorting':
      return labels.actionSorting
    case 'filtering':
      return labels.actionFiltering
    case 'search':
      return labels.actionSearch
    case 'pagination':
      return labels.actionPage
    case 'grouping':
      return labels.actionGrouping
    case 'copy':
      return labels.actionCopy
    case 'selectPage':
      return labels.actionSelectPage
  }
}

/** Заголовок плашки ожидания (ADR 0153, §5): «Идёт поиск…». */
export const serverActionPendingTitle = (
  kind: ServerActionKind,
  labels: TableLabels,
): string => {
  switch (kind) {
    case 'sorting':
      return labels.pendingSorting
    case 'filtering':
      return labels.pendingFiltering
    case 'search':
      return labels.pendingSearch
    case 'pagination':
      return labels.pendingPage
    case 'grouping':
      return labels.pendingGrouping
    case 'copy':
      return labels.pendingCopy
    case 'selectPage':
      return labels.pendingSelectPage
  }
}

/** Отменить ждущее серверное действие таблицы — «стоп» его кнопки (ADR 0153, §2). */
export const cancelServerAction = (table: unknown, source: CancelSource) => {
  chains.get((table as ServerTable).store)?.cancel(source)
}

/** «Стоп» кнопки, начавшей серверное действие: пока оно ждёт (ADR 0153, §2). */
export const serverCancelProps = (
  table: unknown,
  pending: boolean,
  cancelLabel: () => string,
) =>
  pending
    ? {
        onCancel: (event: unknown) =>
          cancelServerAction(table, cancelSourceOf(event)),
        cancelLabel: cancelLabel(),
      }
    : {}

/** Вернуть сортировку и страницу к снимку — повтор отказавшего действия. */
const restore = (t: ServerTable, snapshot: Snapshot) => {
  const { sorting, pagination } = snapshot
  setGroupingTo(t, snapshot)
  if (sorting !== undefined && !sameSorting(t.atoms.sorting?.get(), sorting)) {
    t.setSorting?.(sorting as never)
  }
  if (
    pagination !== undefined &&
    !samePage(t.atoms.pagination?.get(), pagination)
  ) {
    t.setPagination?.(pagination as never)
  }
}

/** Отказ запроса данных — одна запись реестра таблицы (ADR 0177, §1, OB4). */
const SERVER_FAILURE_KEY = 'serverAction'

const resolveServerFailure = (table: unknown) =>
  resolveFailure(table, SERVER_FAILURE_KEY)

const settleIdle = (table: unknown) => {
  resolveServerFailure(table)
  const status = readServerAction(table)
  if (status.pending || status.failed) {
    writeServerAction(table, () => ({}))
  }
}

/**
 * Действие пользователя: `apply` меняет срез, `notify` зовёт бизнес-колбэк. В
 * серверном режиме действие прерывает ожидающее; промис колбэка — ожидание, отказ —
 * откат и отметка в срезе `serverAction`. В клиентском режиме результат игнорируется.
 */
/** Плагин, чей срез ушёл на сервер: от его имени — запрос и итоги (ADR 0125, AL6). */
const SERVER_ACTION_PLUGIN: Record<ServerActionKind, string> = {
  sorting: 'columnSorting',
  filtering: 'columnFiltering',
  search: 'quickSearch',
  pagination: 'pagination',
  grouping: 'rowGrouping',
  copy: 'cellSelection',
  selectPage: 'rowSelection',
}

export const runServerAction = (
  table: unknown,
  kind: ServerActionKind,
  apply: () => void,
  notify: (context: ServerActionContext) => unknown,
  cause?: ServerActionCause,
): void => {
  const t = table as ServerTable
  if (!isServer(t, kind)) {
    apply()
    notify({ signal: (neverAborted ??= new AbortController().signal) })
    return
  }
  cancelPageRestore(t.store)
  const before = snapshotOf(t)
  apply()
  const previous = chains.get(t.store)
  previous?.controller.abort()
  previous?.unregister()
  chains.delete(t.store)
  const plugin = SERVER_ACTION_PLUGIN[kind]
  if (previous) {
    reportAction(table, {
      plugin: SERVER_ACTION_PLUGIN[previous.kind],
      action: 'serverReplaced',
      source: 'auto',
      cause: previous.request,
    })
  }
  const controller = new AbortController()
  const attempt = ++lastAttempt
  const confirmed = previous?.confirmed ?? before

  let result: unknown
  try {
    result = notify({ signal: controller.signal })
  } catch (error) {
    writeServerAction(table, ({ failed }) => (failed ? { failed } : {}))
    throw error
  }
  // Серверная модель строк: ждём окно новой выборки, колбэк приложения — уведомление.
  const load = sourceLoad(table, kind)
  if (load) result = load()
  if (!isThenable(result)) {
    settleIdle(table)
    return
  }

  const request = reportAction(table, {
    plugin,
    action: 'serverRequest',
    detail: { kind },
    source: 'auto',
  })
  // Отмена тихая (ADR 0153, §4): срезы — к состоянию до цепочки, без отметки и плашки отказа.
  let cancelled = false
  const cancel = (source: CancelSource) => {
    if (controller.signal.aborted) return
    cancelled = true
    controller.abort()
    unregister()
    chains.delete(t.store)
    reportAction(table, {
      plugin,
      action: 'cancel',
      detail: { action: kind },
      source,
      cause: request,
    })
    const attempted = snapshotOf(t)
    revert(t, confirmed, true)
    restoreFilters(t, confirmed)
    // Отменённое условие остаётся черновиком, как отказанное (ADR 0154, §2; ADR 0178, §2).
    rejectHandlers.get(t.store)?.get(kind)?.({ attempted, confirmed })
    markLoadCancelled(table)
    writeServerAction(table, () => ({}))
    resolveServerFailure(table)
    announceLabel(table, labels =>
      labels.announceActionCancelled(serverActionName(kind, labels)),
    )
  }
  const unregister = registerPending(table, {
    kind: 'server',
    id: kind,
    cancel,
  })
  chains.set(t.store, {
    controller,
    cancel,
    unregister,
    attempt,
    confirmed,
    kind,
    request,
  })
  writeServerAction(table, status => ({
    ...status,
    pending: { kind, attempt, cause },
  }))
  const settle = (ok: boolean, error?: unknown) => {
    if (cancelled) {
      lateAnswer(table, error)
      return
    }
    if (controller.signal.aborted || chains.get(t.store)?.attempt !== attempt) {
      return
    }
    unregister()
    chains.delete(t.store)
    if (ok) {
      reportAction(table, {
        plugin,
        action: 'serverResolved',
        source: 'auto',
        cause: request,
      })
      settleIdle(table)
      return
    }
    reportAction(table, {
      plugin,
      action: 'serverRejected',
      detail: () => ({ error: rejectionText(error), reverted: true }),
      source: 'auto',
      cause: request,
    })
    const attempted = snapshotOf(t)
    const retry = () =>
      runServerAction(table, kind, () => restore(t, attempted), notify, cause)
    revert(t, confirmed)
    rejectHandlers.get(t.store)?.get(kind)?.({ attempted, confirmed })
    writeServerAction(table, () => ({
      failed: { kind, attempt, error, cause, retry },
    }))
    const labels = announcerLabels(table) ?? ENGLISH_LABELS
    reportFailure(table, {
      key: SERVER_FAILURE_KEY,
      action: { plugin: 'core', action: kind },
      target: { table: true },
      reason: serverActionReason({ kind, error }, labels),
      retry,
      // Запись закрыта в журнале — уходит и плашка (ADR 0177, §7).
      discard: () => dismissServerActionError(table),
    })
  }
  result.then(
    () => settle(true),
    error => settle(false, error),
  )
}

/** Плашка отказа закрыта: отметки отказа снимаются (ADR 0116, §5). */
export const dismissServerActionError = (table: unknown) => {
  if (readServerAction(table).failed) {
    writeServerAction(table, ({ pending }) => (pending ? { pending } : {}))
  }
  resolveServerFailure(table)
}

/** Размонтирование грида (по store таблицы): ожидающее действие прерывается. */
export const abortServerActions = (store: object) => {
  chains.get(store)?.controller.abort()
  chains.get(store)?.unregister()
  chains.delete(store)
  cancelPageRestore(store)
}
