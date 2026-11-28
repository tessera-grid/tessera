/**
 * Канал действий грида (ADR 0125): что сделал пользователь, приложение или сам грид.
 * Опция ядра `onDebugAction` получает действие; плагины и ядро сообщают его через
 * `table.reportAction`, который ставит `commonFeature`.
 */
import { INPUT_MODALITY_ATTR } from './inputModality'
import { isThenable, rejectionText } from '../util/thenable'

/** Where an action came from: pointer, keyboard, an application call, or the grid itself. */
export type DebugActionSource = 'pointer' | 'keyboard' | 'api' | 'auto'

export interface DebugAction {
  /** Sequence number within the table instance, from 1. */
  id: number
  /** `id` of the owner plugin; `'core'` for the core. */
  plugin: string
  action: string
  detail?: unknown
  source: DebugActionSource
  /** Start and end of a gesture: a drag-resize, a drag, an edit session. */
  phase?: 'start' | 'end'
  /** Number of the original action for a deferred outcome. */
  cause?: number
}

export type OnDebugAction = (action: DebugAction) => void

export interface ActionReport {
  plugin: string
  action: string
  /** Parameters; the function is called only when there is a listener. */
  detail?: unknown
  /** `'api'` by default. */
  source?: DebugActionSource
  phase?: 'start' | 'end'
  cause?: number
}

type Reporter = { reportAction?: (report: ActionReport) => number | undefined }

/**
 * Последнее действие текущей задачи — `cause` итога по умолчанию. Ключ — метод
 * `reportAction`: он один у экземпляра и у копий таблицы, которые получают плагины.
 */
const currentActions = new WeakMap<object, number>()

const currentActionOf = (table: unknown): number | undefined => {
  const reporter = (table as Reporter | undefined)?.reportAction
  return reporter ? currentActions.get(reporter) : undefined
}

const lastInputModality = (): 'pointer' | 'keyboard' | undefined => {
  const value =
    typeof document === 'undefined'
      ? null
      : document.documentElement.getAttribute(INPUT_MODALITY_ATTR)
  // Палец — источник `pointer`, как мышь.
  if (value === 'touch') return 'pointer'
  return value === 'pointer' || value === 'keyboard' ? value : undefined
}

/**
 * Source from a browser event: a key is `keyboard`; pressing a button from the keyboard gives
 * a `click` with `detail: 0`; other events are `pointer`; no event means `api`.
 */
export const sourceOf = (event?: unknown): DebugActionSource => {
  const native =
    (event as { nativeEvent?: Event } | undefined)?.nativeEvent ??
    (event as Event | undefined)
  const type = (native as { type?: unknown } | undefined)?.type
  if (typeof type !== 'string') return 'api'
  if (type.startsWith('key')) return 'keyboard'
  // Клик без счётчика нажатий — программный: нажатие кнопки клавишей или клик Base UI
  // по скрытому полю после нажатия мышью. Решает последний ввод (ADR 0084, CB5).
  if (type === 'click' && (native as MouseEvent).detail === 0) {
    return lastInputModality() ?? 'keyboard'
  }
  return 'pointer'
}

/**
 * Источник действия, которое делает только пользователь (открыть поповер): без
 * события — последний ввод, если он известен.
 */
export const userSourceOf = (event?: unknown): DebugActionSource => {
  const source = sourceOf(event)
  return source === 'api' ? (lastInputModality() ?? 'api') : source
}

/** Reports an action; returns `undefined` when the table has no channel or no listener. */
export const reportAction = (
  table: unknown,
  report: ActionReport,
): number | undefined => (table as Reporter | undefined)?.reportAction?.(report)

/**
 * Outcome of an action's async result — a separate `<action>Resolved` or `<action>Rejected`
 * action with `cause`: the given action or the last action of this task. A synchronous result
 * produces no outcome.
 */
export const reportOutcome = (
  table: unknown,
  report: ActionReport,
  result: unknown,
): void => {
  if (!isThenable(result)) return
  const cause = report.cause ?? currentActionOf(table)
  const outcome = (suffix: string, detail?: unknown) =>
    reportAction(table, {
      ...report,
      action: `${report.action}${suffix}`,
      detail,
      source: 'auto',
      phase: undefined,
      cause,
    })
  // Подписка отдельная: промис гриду и приложению остаётся тем же.
  result.then(
    () => outcome('Resolved'),
    (reason: unknown) => outcome('Rejected', rejectionText(reason)),
  )
}

/**
 * Метод `table.reportAction` для `commonFeature`: номер растёт у экземпляра. Номер
 * последнего действия держится до конца задачи — его берёт `reportOutcome`.
 */
export const createActionReporter = (
  listener: () => OnDebugAction | undefined,
) => {
  let last = 0
  const reporter = (report: ActionReport): number | undefined => {
    const onDebugAction = listener()
    if (!onDebugAction) return undefined
    last += 1
    const detail =
      typeof report.detail === 'function'
        ? (report.detail as () => unknown)()
        : report.detail
    onDebugAction({
      id: last,
      plugin: report.plugin,
      action: report.action,
      source: report.source ?? 'api',
      ...(detail !== undefined && { detail }),
      ...(report.phase && { phase: report.phase }),
      ...(report.cause !== undefined && { cause: report.cause }),
    })
    // Итог сам — не причина следующего итога.
    if (report.cause === undefined) {
      const id = last
      currentActions.set(reporter, id)
      queueMicrotask(() => {
        if (currentActions.get(reporter) === id) currentActions.delete(reporter)
      })
    }
    return last
  }
  return reporter
}
