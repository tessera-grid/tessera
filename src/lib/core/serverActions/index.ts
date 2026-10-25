/**
 * Серверные действия (ADR 0116): сортировка, фильтры, поиск и страница серверного
 * режима задают один запрос данных. Колбэк действия получает `signal`; промис —
 * ожидание; отказ откатывает сортировку и страницу к состоянию до первого действия
 * цепочки ожидания. Общий модуль четырёх плагинов — вне их папок (IV3).
 */
import { reportAction } from '../debugActions'
import type { RowSource } from '../rowSource'
import { isThenable, rejectionText } from '../thenable'
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
  pagination?: { pageIndex: number; pageSize: number }
}

interface Chain {
  controller: AbortController
  attempt: number
  /** Сортировка и страница до первого действия цепочки — цель отката. */
  confirmed: Snapshot
  kind: ServerActionKind
  /** Номер запроса в канале действий — `cause` его итогов. */
  request: number | undefined
}

interface ServerTable {
  store: object
  options: {
    manualSorting?: boolean
    manualPagination?: boolean
    columnFilteringServer?: boolean
    quickSearchServer?: boolean
    columnSortingRevertOnReject?: boolean
    paginationRevertOnReject?: boolean
  }
  atoms: {
    sorting?: {
      get: () => unknown
      subscribe: (listener: (value: unknown) => void) => {
        unsubscribe: () => void
      }
    }
    pagination?: { get: () => Snapshot['pagination'] }
  }
  setSorting?: (sorting: never) => void
  setPagination?: (pagination: never) => void
}

// Ключ — общий store: React-адаптер отдаёт гриду другой объект таблицы, чем ячейкам.
const chains = new WeakMap<object, Chain>()
let lastAttempt = 0

let neverAborted: AbortSignal | undefined

/** Серверная модель строк: выборку ведёт её источник (ADR 0138, §6). */
const sourceLoad = (table: unknown, kind: ServerActionKind) =>
  kind === 'pagination'
    ? undefined
    : (table as { getRowSource?: () => RowSource }).getRowSource?.().whenLoaded

const isServer = (t: ServerTable, kind: ServerActionKind) => {
  if (sourceLoad(t, kind)) return true
  const { options } = t
  switch (kind) {
    case 'sorting':
      return !!options.manualSorting
    case 'pagination':
      return !!options.manualPagination
    case 'filtering':
      return !!options.columnFilteringServer
    case 'search':
      return !!options.quickSearchServer
  }
}

const snapshotOf = ({ atoms }: ServerTable): Snapshot => ({
  sorting: atoms.sorting?.get(),
  pagination: atoms.pagination?.get(),
})

const samePage = (a: Snapshot['pagination'], b: Snapshot['pagination']) =>
  a?.pageIndex === b?.pageIndex && a?.pageSize === b?.pageSize

type Sorting = readonly { id: string; desc: boolean }[]

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

/** Откат к состоянию до цепочки; колбэки действий он не зовёт (как PG6). */
const revert = (t: ServerTable, { sorting, pagination }: Snapshot) => {
  const { atoms, store } = t
  const restorePage = () => {
    if (
      t.options.paginationRevertOnReject !== false &&
      pagination !== undefined &&
      !samePage(atoms.pagination?.get(), pagination)
    ) {
      t.setPagination?.(pagination as never)
    }
  }
  // Сортировка первой: при клиентской пагинации её смена сбрасывает страницу.
  if (
    t.options.columnSortingRevertOnReject !== false &&
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

/** Вернуть сортировку и страницу к снимку — повтор отказавшего действия. */
const restore = (t: ServerTable, { sorting, pagination }: Snapshot) => {
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

const settleIdle = (table: unknown) => {
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
  chains.set(t.store, { controller, attempt, confirmed, kind, request })
  writeServerAction(table, status => ({
    ...status,
    pending: { kind, attempt, cause },
  }))
  const settle = (ok: boolean, error?: unknown) => {
    if (controller.signal.aborted || chains.get(t.store)?.attempt !== attempt) {
      return
    }
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
    writeServerAction(table, () => ({
      failed: { kind, attempt, error, cause, retry },
    }))
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
}

/** Размонтирование грида (по store таблицы): ожидающее действие прерывается. */
export const abortServerActions = (store: object) => {
  chains.get(store)?.controller.abort()
  chains.delete(store)
  cancelPageRestore(store)
}
