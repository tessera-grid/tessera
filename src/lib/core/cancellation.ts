/**
 * Отмена длительных операций (ADR 0153): реестр ждущих операций таблицы. Каждая операция с
 * промисом — пункт меню, серверное действие, выгрузка, ленивые дети, копирование —
 * регистрирует свою отмену; кнопки, пункты меню, плашка и `table.cancelPending` отменяют
 * через него.
 */
import { sourceOf } from './debugActions'
import { logWarn } from '../util/logger'

/** Вид ждущей операции — фильтр `table.cancelPending`. */
export type PendingKind =
  | 'menu'
  | 'server'
  | 'export'
  | 'children'
  | 'copy'
  | 'paste'
  | 'fill'
  | 'cellEdit'
  | 'selectPage'
  | 'history'
  | 'write'

/** Источник отмены — в канал действий (ADR 0125). */
export type CancelSource = 'pointer' | 'keyboard' | 'api'

export interface CancelPendingFilter {
  kind?: PendingKind
  /**
   * Id действия меню, формата выгрузки, строки ленивых детей, ячейки сохранения или вид
   * серверного действия.
   */
  id?: string
}

export interface PendingOperation {
  kind: PendingKind
  id: string
  /** Другие id, по которым находится та же операция: ячейки пакета записи (ADR 0219, §6). */
  ids?: { has: (id: string) => boolean }
  cancel: (source: CancelSource) => void
  /**
   * Таблица ушла со страницы: операция бросается без объявления и канала действий, как
   * копирование (ADR 0146, XC17; ADR 0190, XV11).
   */
  drop?: () => void
}

const matches = (operation: PendingOperation, filter: CancelPendingFilter) =>
  (filter.kind === undefined || operation.kind === filter.kind) &&
  (filter.id === undefined ||
    operation.id === filter.id ||
    operation.ids?.has(filter.id) === true)

/** Источник отмены по событию нажатия «стопа» или пункта меню. */
export const cancelSourceOf = (event?: unknown): CancelSource => {
  const source = sourceOf(event)
  return source === 'auto' ? 'api' : source
}

const registries = new WeakMap<object, Set<PendingOperation>>()

const storeOf = (table: unknown) =>
  (table as { store?: object } | undefined)?.store

/** Зарегистрировать ждущую операцию; возвращает снятие с учёта. */
export const registerPending = (
  table: unknown,
  operation: PendingOperation,
): (() => void) => {
  const store = storeOf(table)
  if (!store) return () => {}
  let registry = registries.get(store)
  if (!registry) {
    registry = new Set()
    registries.set(store, registry)
  }
  registry.add(operation)
  return () => registry.delete(operation)
}

/** Id ждущей операции ячейки — общий у плагина-источника и меню ячейки. */
export const cellPendingId = (rowId: string, columnId: string) =>
  `${rowId}\u0000${columnId}`

/** Ждёт ли операция по виду и id — для пункта «Отменить» в меню её объекта. */
export const hasPending = (
  table: unknown,
  filter: CancelPendingFilter = {},
): boolean => {
  const store = storeOf(table)
  const registry = store && registries.get(store)
  if (!registry) return false
  for (const operation of registry) {
    if (matches(operation, filter)) return true
  }
  return false
}

/** Отменить ждущие операции — все или по виду и id; возвращает число отменённых. */
export const cancelPending = (
  table: unknown,
  filter: CancelPendingFilter = {},
  source: CancelSource = 'api',
): number => {
  const store = storeOf(table)
  const registry = store && registries.get(store)
  if (!registry) return 0
  let count = 0
  for (const operation of [...registry]) {
    if (!matches(operation, filter)) continue
    operation.cancel(source)
    count++
  }
  return count
}

/** Таблица ушла со страницы: ждущие операции, умеющие бросаться, бросаются. */
export const dropPending = (store: object) => {
  const registry = registries.get(store)
  if (!registry) return
  for (const operation of [...registry]) operation.drop?.()
}

const cancelledLoads = new WeakSet<object>()

/**
 * Отмена сняла загрузку всей таблицы и откатила её срезы (ADR 0153, §4): живая область
 * объявляет отмену, а не откат сортировки и не «загружено».
 */
export const markLoadCancelled = (table: unknown) => {
  const store = storeOf(table)
  if (store) cancelledLoads.add(store)
}

/**
 * Конец загрузки уже объявлен своим текстом: перезапрос окна транзакцией строк объявляет
 * добавленные строки (ADR 0157, §4), а не «загружено».
 */
export const markLoadAnnounced = markLoadCancelled

/** Коммит после отмены: пометку снимает первое же чтение. */
export const takeLoadCancelled = (table: unknown) => {
  const store = storeOf(table)
  return !!store && cancelledLoads.delete(store)
}

/** Отказ — прерывание по `signal`: приложение его учло. */
const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * Промис операции кончился после отмены (ADR 0153, §6): его итог гриду не нужен. Если
 * приложение не прервало запрос по `signal`, в dev — одно предупреждение.
 */
export const lateAnswer = (table: unknown, error?: unknown) => {
  if (error !== undefined && isAbort(error)) return
  logWarn(
    table as Parameters<typeof logWarn>[0],
    'a cancelled operation settled later: pass the signal to the request so it stops (ADR 0153)',
    'cancel:late-answer',
  )
}
