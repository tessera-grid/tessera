/**
 * Канал действий грида (ADR 0125): что сделал пользователь, приложение или сам грид.
 * Опция ядра `onDebugAction` получает действие; плагины и ядро сообщают его через
 * `table.reportAction`, который ставит `commonFeature`.
 */
import { INPUT_MODALITY_ATTR } from './inputModality'
import { isThenable, rejectionText } from '../util/thenable'

/** Откуда действие: указатель, клавиатура, вызов приложения или сам грид. */
export type DebugActionSource = 'pointer' | 'keyboard' | 'api' | 'auto'

export interface DebugAction {
  /** Порядковый номер у экземпляра таблицы, с 1. */
  id: number
  /** `id` плагина-владельца; `'core'` — ядро. */
  plugin: string
  action: string
  detail?: unknown
  source: DebugActionSource
  /** Начало и конец жеста: протяжки, перетаскивания, сессии правки. */
  phase?: 'start' | 'end'
  /** Номер исходного действия у отложенного итога. */
  cause?: number
}

export type OnDebugAction = (action: DebugAction) => void

export interface ActionReport {
  plugin: string
  action: string
  /** Параметры; функция вызывается, только если есть слушатель. */
  detail?: unknown
  /** По умолчанию — `'api'`. */
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
  return value === 'pointer' || value === 'keyboard' ? value : undefined
}

/**
 * Источник по событию браузера: клавиша — `keyboard`; нажатие кнопки с клавиатуры даёт
 * `click` с `detail: 0`; остальное из событий — `pointer`; без события — `api`.
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

/** Сообщить действие; без канала у таблицы и без слушателя — `undefined`. */
export const reportAction = (
  table: unknown,
  report: ActionReport,
): number | undefined => (table as Reporter | undefined)?.reportAction?.(report)

/**
 * Итог асинхронного результата действия — отдельное действие `<action>Resolved` или
 * `<action>Rejected` с `cause`: заданным или последним действием этой задачи.
 * Синхронный результат итога не даёт.
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
