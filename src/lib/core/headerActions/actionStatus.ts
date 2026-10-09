/**
 * Асинхронные действия меню (ADR 0078): проверка доступности промисом из `disabled`,
 * ожидание и отказ промиса из `onSelect`. Ожидание и отказ — в срезе `actionStatus` по
 * ключу «цель + действие»; проверка доступности — в сессии открытого меню.
 */
import { announceLabel } from '../announcer'
import type { TableLabels } from '../localization'
import { isThenable, rejectionText } from '../thenable'
import {
  type ActionStatus,
  type ActionStatusEntry,
  readActionStatus,
  writeActionStatus,
} from './actionStatusFeature'
import type { DisabledResult, DisabledState, MenuAction } from './types'

interface TargetContext {
  row?: { id: string }
  column?: { id: string }
  header?: { column: { id: string } }
}

/** Цель действия: ячейка строки (кебаб строки, контекстное меню) или колонка заголовка. */
export const actionTarget = (ctx: unknown): string => {
  const { row, column, header } = ctx as TargetContext
  const columnId = column?.id ?? header?.column.id ?? ''
  return row ? `cell:${row.id}:${columnId}` : `column:${columnId}`
}

export const actionStatusKey = (action: { id: string }, ctx: unknown) =>
  `${actionTarget(ctx)}|${action.id}`

const tableOf = (ctx: unknown) => (ctx as { table: unknown }).table

const without = (status: ActionStatus, keys: string[]): ActionStatus => {
  const present = keys.filter(key => key in status)
  if (present.length === 0) return status
  const next = { ...status }
  present.forEach(key => delete next[key])
  return next
}

/** Текст отказа: свой у действия, иначе из ошибки, иначе подпись по умолчанию. */
export const actionErrorText = (
  action: MenuAction,
  ctx: unknown,
  error: unknown,
  labels: TableLabels,
): string =>
  action.errorMessage?.(ctx, error, labels) ??
  rejectionText(error) ??
  labels.actionFailedFallback

let flashSeq = 0

/**
 * Выбор действия. Промис от `onSelect` — ожидание в срезе до итога; отказ оставляет
 * отметку (`keepError`, меню) или только вспышку (инлайн-кнопка). Пока действие ждёт,
 * повторный выбор в той же цели ничего не делает.
 */
export const runMenuAction = (
  action: MenuAction,
  ctx: unknown,
  event?: Parameters<MenuAction['onSelect']>[1],
  { keepError = true }: { keepError?: boolean } = {},
) => {
  const table = tableOf(ctx)
  const key = actionStatusKey(action, ctx)
  if (readActionStatus(table)[key]?.pending) return

  const result = action.onSelect(ctx, event)
  // Вне грида (кнопка без таблицы) ожидать некому и объявлять негде.
  if (!isThenable(result) || !table) return

  const name = (labels: TableLabels) => action.label(ctx, labels)
  const menu = keepError
  writeActionStatus(table, status => ({
    ...status,
    [key]: { pending: true, action, menu },
  }))
  Promise.resolve(result).then(
    () => {
      writeActionStatus(table, status => without(status, [key]))
      announceLabel(table, labels => labels.announceActionDone(name(labels)))
    },
    (error: unknown) => {
      flashSeq += 1
      const entry: ActionStatusEntry = keepError
        ? { failed: true, error, flash: flashSeq, action, menu }
        : { flash: flashSeq }
      writeActionStatus(table, status => ({ ...status, [key]: entry }))
      announceLabel(table, labels =>
        labels.announceActionFailed(
          name(labels),
          actionErrorText(action, ctx, error, labels),
        ),
      )
    },
  )
}

/** Состояние кебаба: ждущие и неувиденные упавшие действия, ключ вспышки. */
export interface KebabStatus {
  running: MenuAction[]
  failed: MenuAction[]
  flash?: number
}

/** Записи меню этой цели — корня и разделов (ADR 0079). */
const menuEntriesOf = (status: ActionStatus, ctx: unknown) => {
  const prefix = `${actionTarget(ctx)}|`
  return Object.entries(status).filter(
    ([key, entry]) => key.startsWith(prefix) && entry.menu,
  )
}

export const kebabStatus = (
  status: ActionStatus,
  ctx: unknown,
): KebabStatus => {
  const result: KebabStatus = { running: [], failed: [] }
  for (const [, entry] of menuEntriesOf(status, ctx)) {
    const action = entry.action!
    if (entry.pending) result.running.push(action)
    if (entry.failed && !entry.seen) result.failed.push(action)
    if (entry.flash !== undefined) {
      result.flash = Math.max(result.flash ?? 0, entry.flash)
    }
  }
  return result
}

/** Доступное имя и тултип кебаба: основа + ждущие + упавшие действия. */
export const kebabLabel = (
  base: string,
  { running, failed }: KebabStatus,
  ctx: unknown,
  labels: TableLabels,
): string => {
  const names = (list: MenuAction[]) =>
    list.map(action => action.label(ctx, labels)).join(', ')
  return [
    base,
    running.length > 0 && labels.actionsRunning(names(running)),
    failed.length > 0 && labels.actionsFailed(names(failed)),
  ]
    .filter(Boolean)
    .join('. ')
}

/** Меню открыто: отказы его действий показаны — отметка с кебаба снимается. */
export const markActionErrorsSeen = (ctx: unknown) => {
  const status = readActionStatus(tableOf(ctx))
  const keys = menuEntriesOf(status, ctx)
    .filter(([, entry]) => entry.failed && !entry.seen)
    .map(([key]) => key)
  if (keys.length === 0) return
  writeActionStatus(tableOf(ctx), prev => {
    const next = { ...prev }
    keys.forEach(key => {
      if (next[key]?.failed) next[key] = { ...next[key], seen: true }
    })
    return next
  })
}

/** Меню закрыто: увиденные отказы убираются. */
export const clearSeenActionErrors = (ctx: unknown) => {
  const keys = menuEntriesOf(readActionStatus(tableOf(ctx)), ctx)
    .filter(([, entry]) => entry.failed && entry.seen)
    .map(([key]) => key)
  if (keys.length > 0) {
    writeActionStatus(tableOf(ctx), prev => without(prev, keys))
  }
}

// --- Проверка доступности ----------------------------------------------------

/** Почему пункт заблокирован; `undefined` — доступен. `true` — запрещено без текста. */
export const blockOf = (result: DisabledResult): DisabledState | undefined =>
  result === true ? { kind: 'forbidden' } : result || undefined

/** Текст отказа проверки: свой у действия, иначе из ошибки, иначе подпись. */
export const checkErrorText = (
  action: MenuAction,
  ctx: unknown,
  error: unknown,
  labels: TableLabels,
): string =>
  action.errorMessage?.(ctx, error, labels) ??
  rejectionText(error) ??
  labels.availabilityCheckFailed

/** Дескрипторы, чей `disabled` уже возвращал промис: рендер их не вызывает. */
const asyncDisabled = new WeakSet<object>()
let probeSignal: AbortSignal | undefined

/**
 * Синхронное значение `disabled` для рендера. `'async'` — дескриптор асинхронный:
 * его проверяет только сессия меню. Пробный вызов получает прерванный `signal`.
 */
export const readSyncDisabled = (
  action: MenuAction,
  ctx: unknown,
): DisabledResult | 'async' => {
  if (!action.disabled) return false
  if (asyncDisabled.has(action)) return 'async'
  probeSignal ??= AbortSignal.abort()
  const result = action.disabled(ctx, probeSignal)
  if (!isThenable(result)) return result
  asyncDisabled.add(action)
  Promise.resolve(result).catch(() => {})
  return 'async'
}

export type AvailabilityCheck =
  | { status: 'pending' }
  | { status: 'done'; result: DisabledResult }
  | { status: 'failed'; error: unknown }

export type AvailabilityChecks = Record<string, AvailabilityCheck>

/**
 * Проверить одно действие в сессии. Синхронный итог возвращается сразу (у обычных
 * дескрипторов — `undefined`: рендер читает их живыми), асинхронный приходит в
 * `onSettled`, пока сессия не прервана.
 */
export const checkAvailability = (
  action: MenuAction,
  ctx: unknown,
  signal: AbortSignal,
  onSettled: (check: AvailabilityCheck) => void,
): AvailabilityCheck | undefined => {
  if (!action.disabled) return undefined
  let result: DisabledResult | Promise<DisabledResult>
  try {
    result = action.disabled(ctx, signal)
  } catch (error) {
    return { status: 'failed', error }
  }
  if (!isThenable(result)) {
    return asyncDisabled.has(action) ? { status: 'done', result } : undefined
  }
  asyncDisabled.add(action)
  Promise.resolve(result).then(
    value => {
      if (!signal.aborted) onSettled({ status: 'done', result: value })
    },
    (error: unknown) => {
      if (!signal.aborted) onSettled({ status: 'failed', error })
    },
  )
  return { status: 'pending' }
}

/** Начать сессию проверки всех действий меню. */
export const startAvailabilityChecks = (
  actions: MenuAction[],
  ctx: unknown,
  signal: AbortSignal,
  onSettled: (id: string, check: AvailabilityCheck) => void,
): AvailabilityChecks => {
  const checks: AvailabilityChecks = {}
  for (const action of actions) {
    const check = checkAvailability(action, ctx, signal, settled =>
      onSettled(action.id, settled),
    )
    if (check) checks[action.id] = check
  }
  return checks
}

export interface Availability {
  /** Выбрать нельзя: идёт проверка или есть причина блокировки. */
  disabled: boolean
  checking: boolean
  /** Причина блокировки — галочка или замок у правого края. */
  block?: DisabledState
  /** Проверка не удалась: пункт доступен, нажатие проверяет заново. */
  checkFailed: boolean
  checkError?: unknown
}

const fromResult = (result: DisabledResult): Availability => {
  const block = blockOf(result)
  return { disabled: !!block, checking: false, block, checkFailed: false }
}

/** Доступность пункта в меню: итог сессии, иначе синхронное значение. */
export const resolveAvailability = (
  action: MenuAction,
  ctx: unknown,
  checks: AvailabilityChecks | null | undefined,
): Availability => {
  const check = checks?.[action.id]
  if (check?.status === 'pending') {
    return { disabled: true, checking: true, checkFailed: false }
  }
  if (check?.status === 'failed') {
    return {
      disabled: false,
      checking: false,
      checkFailed: true,
      checkError: check.error,
    }
  }
  if (check) return fromResult(check.result)
  const sync = readSyncDisabled(action, ctx)
  return sync === 'async'
    ? { disabled: true, checking: true, checkFailed: false }
    : fromResult(sync)
}
