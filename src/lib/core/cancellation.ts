/**
 * Отмена длительных операций (ADR 0153): реестр ждущих операций таблицы. Каждая операция с
 * промисом — пункт меню, серверное действие, выгрузка, ленивые дети, копирование —
 * регистрирует свою отмену; кнопки, пункты меню, плашка и `table.cancelPending` отменяют
 * через него.
 */
import { sourceOf } from './debugActions'
import { logWarn } from './logger'

/** Вид ждущей операции — фильтр `table.cancelPending`. */
export type PendingKind = 'menu' | 'server' | 'export' | 'children' | 'copy'

/** Источник отмены — в канал действий (ADR 0125). */
export type CancelSource = 'pointer' | 'keyboard' | 'api'

export interface CancelPendingFilter {
  kind?: PendingKind
  /** Id действия меню, формата выгрузки, строки ленивых детей или вид серверного действия. */
  id?: string
}

export interface PendingOperation {
  kind: PendingKind
  id: string
  cancel: (source: CancelSource) => void
}

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
    if (filter.kind !== undefined && operation.kind !== filter.kind) continue
    if (filter.id !== undefined && operation.id !== filter.id) continue
    operation.cancel(source)
    count++
  }
  return count
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
