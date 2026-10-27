/**
 * Снимок активности подключённых плагинов (`table.getPluginDiagnostics()`,
 * ADR 0022, PC12–PC14). Считается на момент вызова по текущему состоянию, а не по
 * мере рендера: инертен ли плагин, решает его `diagnose` — та же проверка, что
 * гасит его `getCan*`.
 */
import { logError, logWarn } from './logger'

/** Почему подключённый плагин сейчас ничего не делает. */
export type PluginInertReason =
  | 'disabled'
  | 'multiLevelHeader'
  | 'grouping'
  | 'sorting'
  | 'filtering'
  | 'noToolbar'
  | 'noStatusBar'
  | 'noActions'
  | 'noRowCount'
  | 'noGetRows'
  | 'serverRowModel'
  | 'addedAfterMount'
  | 'removedAfterMount'
  | (string & {})

export type PluginDiagnostic =
  | { id: string; status: 'active' }
  | { id: string; status: 'inert'; reason: PluginInertReason }
  | { id: string; status: 'error'; error: string }

/** Проверка плагина: причина инертности или `undefined`, если плагин работает. */
export type PluginDiagnose = (table: unknown) => PluginInertReason | undefined

/**
 * Строки ведёт серверная модель (ADR 0138, §13): клиентские страницы, лента, перестановка,
 * группировка и дерево в этом режиме ничего не делают.
 */
export const serverRowModelReason = (
  table: unknown,
): PluginInertReason | undefined =>
  typeof (table as { options?: { getRowSource?: unknown } }).options
    ?.getRowSource === 'function'
    ? 'serverRowModel'
    : undefined

/**
 * Жесты, клавиши и копирование выделения ячеек — только с плагином интерфейса (ADR 0120);
 * в серверной модели строк — по индексам (ADR 0146).
 */
export const isCellSelectionInteractive = (table: unknown) =>
  (table as { options?: { cellSelectionInteraction?: boolean } }).options
    ?.cellSelectionInteraction === true

/** `diagnose` плагина, у которого нет условий инертности (ADR 0036, PQ1). */
export const neverInert: PluginDiagnose = () => undefined

type ActionsTable = {
  options: {
    slotActions?: Partial<Record<string, readonly unknown[]>>
    actionMenu?: Partial<Record<string, unknown>>
    contextMenuActions?: readonly unknown[]
  }
}

/** `'noActions'`, если ни в одном из слотов нет действий (ADR 0036, PQ3). */
export const noSlotActionsReason = (
  table: unknown,
  slots: readonly string[],
): PluginInertReason | undefined => {
  const { slotActions } = (table as ActionsTable).options
  return slots.some(slot => (slotActions?.[slot]?.length ?? 0) > 0)
    ? undefined
    : 'noActions'
}

/** Слоты, которые схлопывает плагин-меню (по свёрнутой карте `actionMenu`). */
export const menuSlotsOf = (table: unknown, candidates: readonly string[]) =>
  candidates.filter(slot => (table as ActionsTable).options.actionMenu?.[slot])

/** Контекстное меню без пунктов (ADR 0036, PQ3). */
export const noContextMenuActionsReason = (
  table: unknown,
): PluginInertReason | undefined =>
  ((table as ActionsTable).options.contextMenuActions?.length ?? 0) > 0
    ? undefined
    : 'noActions'

export interface PluginDiagnosticSource {
  id: string
  enabled?: boolean
  diagnose?: PluginDiagnose
  /** Причина, заданная ядром (состав набора, ADR 0039); важнее `enabled` и `diagnose`. */
  reason?: PluginInertReason
}

/** Предупреждает о каждой инертной записи снимка, кроме `disabled` (ADR 0036, PQ2). */
export const warnInertPlugins = (
  diagnostics: readonly PluginDiagnostic[],
  table: unknown,
): void => {
  for (const diagnostic of diagnostics) {
    if (diagnostic.status === 'inert' && diagnostic.reason !== 'disabled') {
      warnPluginInert(table, diagnostic.id, diagnostic.reason)
    }
  }
}

/** Первая пойманная ошибка каждого плагина таблицы (ADR 0037). */
export interface PluginErrorRegistry {
  get: (pluginId: string) => string | undefined
  report: (pluginId: string, error: unknown) => void
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const createPluginErrorRegistry = (
  table: unknown,
): PluginErrorRegistry => {
  const errors = new Map<string, string>()
  return {
    get: pluginId => errors.get(pluginId),
    report: (pluginId, error) => {
      const message = errorMessage(error)
      if (!errors.has(pluginId)) {
        errors.set(pluginId, message)
      }
      logError(
        table as Parameters<typeof logError>[0],
        `${pluginId} упал: ${message}`,
        `${pluginId}:error`,
      )
    },
  }
}

/** Сообщить таблице об ошибке плагина; без commonFeature — no-op. */
export const reportPluginError = (
  table: unknown,
  pluginId: string,
  error: unknown,
): void =>
  (
    table as {
      reportPluginError?: (pluginId: string, error: unknown) => void
    } | null
  )?.reportPluginError?.(pluginId, error)

export const resolvePluginDiagnostics = (
  sources: readonly PluginDiagnosticSource[],
  table: unknown,
  errors?: PluginErrorRegistry,
): PluginDiagnostic[] =>
  sources.map(({ id, enabled, diagnose, reason: forced }): PluginDiagnostic => {
    const known = errors?.get(id)
    if (known !== undefined) {
      return { id, status: 'error', error: known }
    }
    let reason: PluginInertReason | undefined
    try {
      reason = forced ?? (enabled === false ? 'disabled' : diagnose?.(table))
    } catch (error) {
      errors?.report(id, error)
      return { id, status: 'error', error: errorMessage(error) }
    }
    return reason === undefined
      ? { id, status: 'active' }
      : { id, status: 'inert', reason }
  })

const INERT_MESSAGES: Record<string, string> = {
  multiLevelHeader: 'под многоуровневой шапкой не поддержан',
  grouping: 'при активной группировке управление переходит к rowGrouping',
  sorting: 'при активной сортировке порядком строк владеет сортировка',
  noToolbar:
    'тулбар запрещён (enableToolbar: false) — у плагина нет поверхности',
  noStatusBar:
    'нижняя панель запрещена (enableStatusBar: false) — у плагина нет поверхности',
  noActions: 'нечего показать: ни один плагин не добавил действий',
  noRowCount:
    'в серверном режиме нужен rowCount (0, пока ответ сервера не пришёл)',
  addedAfterMount:
    'добавлен в plugins после монтирования: TanStack v9 собирает фичи в конструкторе, плагин не подключится — держите его в наборе с enabled: false или пересоздайте таблицу (key)',
  removedAfterMount:
    'удалён из plugins после монтирования: фича осталась в таблице и выключена как enabled: false — держите плагин в наборе с enabled: false или пересоздайте таблицу (key)',
}

/**
 * Dev-warn инертности (ADR 0022, 0036): один раз на `<pluginId>:<reason>`. Зовётся
 * из `getCan*` (только когда потребитель фичу запросил) и ядром при монтировании.
 */
export const warnPluginInert = (
  table: unknown,
  pluginId: string,
  reason: PluginInertReason,
  detail = INERT_MESSAGES[reason] ?? reason,
): void =>
  logWarn(
    table as Parameters<typeof logWarn>[0],
    `${pluginId} инертен: ${detail}`,
    `${pluginId}:${reason}`,
  )
