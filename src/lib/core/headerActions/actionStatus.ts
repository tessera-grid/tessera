/**
 * Асинхронные действия меню (ADR 0078): проверка доступности промисом из `disabled`,
 * ожидание и отказ промиса из `onSelect`. Ожидание и отказ — в срезе `actionStatus` по
 * ключу «цель + действие»; проверка доступности — в сессии открытого меню.
 */
import { actionDetailOf, actionOwnerOf } from '../actionOwners'
import { slotOfAction } from './sectionSlots'
import { announceLabel, announcerLabels } from '../announcer'
import {
  failureKeyOf,
  reportFailure,
  resolveFailure,
  type FailureTarget,
} from '../failures/failuresFeature'
import { reportAction, reportOutcome, sourceOf } from '../debugActions'
import { flashOutcome } from '../flashes/flashFeature'
import {
  type FlashTarget,
  targetContains,
} from '../highlights/highlightFeature'
import { selectionRangeTargets } from '../highlights/targetRanges'
import {
  type CancelSource,
  lateAnswer,
  markLoadCancelled,
  registerPending,
} from '../cancellation'
import type { TableLabels } from '../localization'
import { ENGLISH_LABELS } from '../localization/resolveLabels'
import { isThenable, rejectionText } from '../../util/thenable'
import {
  type ActionStatus,
  type ActionStatusEntry,
  readActionStatus,
  writeActionStatus,
} from './actionStatusFeature'
import type {
  DisabledResult,
  DisabledState,
  MenuAction,
  SlotName,
} from './types'
import { actionRefOf, menuActionLabel } from '../actions'

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

interface ContextMenuTargetContext {
  row?: { id: string }
  column?: { id: string }
  selection?: { isInSelection: boolean; isMultiple: boolean }
}

/**
 * Цель по умолчанию (ADR 0152, §1): у пункта контекстного меню — ячейка, где его открыли,
 * а на выделении из нескольких ячеек — выделение целиком. У кебабов и инлайн-кнопок — нет.
 */
export const defaultActionTarget = (
  ctx: unknown,
): FlashTarget | readonly FlashTarget[] | undefined => {
  const { row, column, selection } = ctx as ContextMenuTargetContext
  if (!selection || !row || !column) return undefined
  if (selection.isInSelection && selection.isMultiple) {
    const ranges = selectionRangeTargets(tableOf(ctx))
    if (ranges.length > 0) return ranges.length === 1 ? ranges[0] : ranges
  }
  return { cell: [row.id, column.id] }
}

/**
 * Объект действия кебаба и инлайн-кнопки по его слоту (ADR 0177, §1): строка, колонка или
 * ячейка — ожидание волной на нём, отказ — его вспышкой.
 */
const slotTarget = (
  action: MenuAction,
  ctx: unknown,
): FlashTarget | undefined => {
  const { row, column, header } = ctx as ContextMenuTargetContext & {
    header?: { column?: { id: string } }
  }
  switch (slotOfAction(action) as SlotName | undefined) {
    case 'actionRowSlot':
      return row && { row: row.id }
    case 'leftHeaderSlot':
    case 'rightHeaderSlot': {
      const id = (column ?? header?.column)?.id
      return id === undefined ? undefined : { column: id }
    }
    case 'leftCellSlot':
    case 'rightCellSlot':
      return row && column && { cell: [row.id, column.id] }
    default:
      return undefined
  }
}

const targetOf = (action: MenuAction, ctx: unknown) => {
  const fallback = defaultActionTarget(ctx) ?? slotTarget(action, ctx)
  return action.target ? action.target(ctx, fallback) : fallback
}

const targetsOf = (
  target: ReturnType<typeof targetOf>,
): readonly FlashTarget[] => {
  if (!target || target === 'table') return []
  return Array.isArray(target) ? target : [target as FlashTarget]
}

/** Цель итога действия: своя `target` или цель по умолчанию; пусто — без цели. */
export const actionTargets = (
  action: MenuAction,
  ctx: unknown,
): readonly FlashTarget[] => targetsOf(targetOf(action, ctx))

interface Running {
  cancel: (source: CancelSource) => void
}

/** Ждущие действия меню по ключу «цель + действие»: их отмена (ADR 0153). */
const running = new WeakMap<object, Map<string, Running>>()

const runningOf = (table: unknown) => {
  const store = (table as { store: object }).store
  let map = running.get(store)
  if (!map) {
    map = new Map()
    running.set(store, map)
  }
  return map
}

/**
 * Ждущее действие слота — кебаба или инлайн-кнопки, — чья цель содержит ячейку (ADR 0177,
 * §8): его отменяет пункт контекстного меню. Действия самого контекстного меню (без слота) свою
 * отмену несут в своём пункте (ADR 0153, §3).
 */
export const runningSlotActionAt = (
  table: unknown,
  rowId: string,
  columnId: string,
) => {
  const runs = runningOf(table)
  for (const [key, entry] of Object.entries(readActionStatus(table))) {
    const slot = (entry.action as { slot?: unknown } | undefined)?.slot
    if (!entry.pending || !slot || !entry.target || !runs.has(key)) continue
    if (entry.target.some(item => targetContains(table, item, rowId, columnId)))
      return { key, action: entry.action! }
  }
  return undefined
}

/** Отменить ждущее действие по ключу записи его ожидания. */
export const cancelRunningAction = (
  table: unknown,
  key: string,
  source: CancelSource,
) => runningOf(table).get(key)?.cancel(source)

/** Отменить ждущее действие меню в цели (ADR 0153, §2–§3). */
export const cancelMenuAction = (
  action: { id: string },
  ctx: unknown,
  source: CancelSource,
) => {
  const table = tableOf(ctx)
  runningOf(table).get(actionStatusKey(action, ctx))?.cancel(source)
}

/**
 * Выбор действия. Промис от `onSelect` — ожидание в срезе до итога; отказ оставляет
 * отметку — на кебабе (`keepError`, меню) или на инлайн-кнопке (ADR 0136). Пока действие
 * ждёт, повторный выбор в той же цели ничего не делает.
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

  // Канал действий (ADR 0125, AL4): владелец — плагин, из которого ядро собрало действие.
  const report = {
    plugin: actionOwnerOf(action),
    action: action.id,
    detail: () => actionDetailOf(ctx),
    source: sourceOf(event),
  }
  const id = reportAction(table, report)
  const controller = new AbortController()
  const result = action.onSelect(ctx, event, { signal: controller.signal })
  reportOutcome(table, { ...report, detail: undefined, cause: id }, result)
  // Вне грида (кнопка без таблицы) ожидать некому и объявлять негде.
  if (!isThenable(result) || !table) return

  const name = (labels: TableLabels) => menuActionLabel(action, ctx, labels)
  const menu = keepError
  const raw = targetOf(action, ctx)
  const targets = targetsOf(raw)
  const target = targets.length > 0 ? targets : undefined
  const whole = raw === 'table' || undefined
  // Ожидание — на объекте действия, откуда бы его ни начали (ADR 0177, §1).
  const wave = !!target || undefined
  writeActionStatus(table, status => ({
    ...status,
    [key]: { pending: true, action, menu, target, wave, table: whole },
  }))
  // Отмена тихая (ADR 0153, §4): ожидание снято, ни отметки, ни вспышки.
  const runs = runningOf(table)
  const done = () => {
    runs.delete(key)
    unregister()
  }
  const cancel = (source: CancelSource) => {
    if (controller.signal.aborted) return
    controller.abort()
    done()
    if (whole) markLoadCancelled(table)
    writeActionStatus(table, status => without(status, [key]))
    reportAction(table, {
      plugin: report.plugin,
      action: 'cancel',
      detail: { action: action.id },
      source,
      cause: id,
    })
    announceLabel(table, labels => labels.announceActionCancelled(name(labels)))
  }
  const failureTargets: readonly FailureTarget[] = whole
    ? [{ table: true }]
    : (target ?? [])
  const unregister = registerPending(table, {
    kind: 'menu',
    id: action.id,
    cancel,
  })
  runs.set(key, { cancel })
  Promise.resolve(result).then(
    () => {
      if (controller.signal.aborted) return lateAnswer(table)
      done()
      writeActionStatus(table, status => without(status, [key]))
      for (const item of failureTargets)
        resolveFailure(table, failureKeyOf(item))
      announceLabel(table, labels => labels.announceActionDone(name(labels)))
    },
    (error: unknown) => {
      if (controller.signal.aborted) return lateAnswer(table, error)
      done()
      const entry: ActionStatusEntry = {
        failed: true,
        error,
        action,
        menu,
        table: whole,
        ...(whole && {
          name,
          reason: (labels: TableLabels) =>
            actionErrorText(action, ctx, error, labels),
          retry: () => runMenuAction(action, ctx, undefined, { keepError }),
        }),
      }
      writeActionStatus(table, status => ({ ...status, [key]: entry }))
      // Отказ — в реестр по каждой цели (ADR 0177, §6): у ячейки — треугольник.
      const labels = announcerLabels(table) ?? ENGLISH_LABELS
      for (const item of failureTargets)
        reportFailure(table, {
          action: actionRefOf(action, ctx, labels),
          target: item,
          reason: actionErrorText(action, ctx, error, labels),
          retry: () => runMenuAction(action, ctx, undefined, { keepError }),
        })
      // Отказ — на цели в кадре, где кнопка-инициатор гасит дугу (ADR 0152, §2).
      if (target) flashOutcome(table, target, 'reverted')
      announceLabel(table, labels =>
        labels.announceActionFailed(
          name(labels),
          actionErrorText(action, ctx, error, labels),
        ),
      )
    },
  )
}

interface BusyTarget {
  target: FlashTarget
  wave: boolean
}

const busyTargets = new WeakMap<ActionStatus, readonly BusyTarget[]>()

/** Цели ждущих действий — один раз на объект среза. */
const busyTargetsOf = (status: ActionStatus): readonly BusyTarget[] => {
  let targets = busyTargets.get(status)
  if (!targets) {
    targets = Object.values(status).flatMap(entry =>
      entry.pending && entry.target
        ? entry.target.map(target => ({ target, wave: !!entry.wave }))
        : [],
    )
    busyTargets.set(status, targets)
  }
  return targets
}

/** Есть ли ждущее действие с волной на цели (ADR 0155, §1). */
export const hasWaveTargets = (status: ActionStatus | undefined) =>
  !!status && busyTargetsOf(status).some(busy => busy.wave)

/**
 * Ожидание ячейки (ADR 0152, §3; ADR 0155, §1): `'wave'` — в цели действия из контекстного
 * меню, `'busy'` — в цели действия с видимым инициатором.
 */
export const cellPendingOf = (
  table: unknown,
  status: ActionStatus | undefined,
  rowId: string,
  columnId: string,
): 'wave' | 'busy' | undefined => {
  if (!status) return undefined
  let pending: 'wave' | 'busy' | undefined
  for (const { target, wave } of busyTargetsOf(status)) {
    if (!targetContains(table, target, rowId, columnId)) continue
    if (wave) return 'wave'
    pending = 'busy'
  }
  return pending
}

/** Ждёт ли действие всей таблицы (ADR 0155, §2). */
export const tableActionPending = (status: ActionStatus | undefined) =>
  !!status && Object.values(status).some(entry => entry.pending && entry.table)

interface TableFailure {
  key: string
  entry: ActionStatusEntry
}

const tableFailures = new WeakMap<ActionStatus, TableFailure | null>()

/** Отказ действия всей таблицы для плашки — пока её не закрыли; один объект на срез. */
export const tableActionFailure = (status: ActionStatus | undefined) => {
  if (!status) return undefined
  let failure = tableFailures.get(status)
  if (failure === undefined) {
    failure = null
    for (const [key, entry] of Object.entries(status)) {
      if (entry.failed && entry.table && !entry.dismissed) {
        failure = { key, entry }
        break
      }
    }
    tableFailures.set(status, failure)
  }
  return failure ?? undefined
}

/** Плашку отказа действия всей таблицы закрыли: отметка на кебабе остаётся. */
export const dismissTableActionFailure = (table: unknown, key: string) =>
  writeActionStatus(table, status =>
    status[key]
      ? { ...status, [key]: { ...status[key], dismissed: true } }
      : status,
  )

/** Состояние кебаба: ждущие и неувиденные упавшие действия. */
export interface KebabStatus {
  running: MenuAction[]
  failed: MenuAction[]
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
    list.map(action => menuActionLabel(action, ctx, labels)).join(', ')
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
