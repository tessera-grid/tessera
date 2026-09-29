/**
 * Снимок активности подключённых плагинов (`table.getPluginDiagnostics()`,
 * ADR 0022, PC12–PC14). Считается на момент вызова по текущему состоянию, а не по
 * мере рендера: инертен ли плагин, решает его `diagnose` — та же проверка, что
 * гасит его `getCan*`.
 */
import { logWarn } from './logger'

/** Почему подключённый плагин сейчас ничего не делает. */
export type PluginInertReason =
  | 'disabled'
  | 'multiLevelHeader'
  | 'grouping'
  | 'sorting'
  | 'noToolbar'
  | 'noActions'
  | (string & {})

export type PluginDiagnostic =
  | { id: string; status: 'active' }
  | { id: string; status: 'inert'; reason: PluginInertReason }

/** Проверка плагина: причина инертности или `undefined`, если плагин работает. */
export type PluginDiagnose = (table: unknown) => PluginInertReason | undefined

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

export const resolvePluginDiagnostics = (
  sources: readonly PluginDiagnosticSource[],
  table: unknown,
): PluginDiagnostic[] =>
  sources.map(({ id, enabled, diagnose }) => {
    const reason = enabled === false ? 'disabled' : diagnose?.(table)
    return reason === undefined
      ? { id, status: 'active' }
      : { id, status: 'inert', reason }
  })

const INERT_MESSAGES: Record<string, string> = {
  multiLevelHeader: 'под многоуровневой шапкой не поддержан',
  grouping: 'при активной группировке управление переходит к rowGrouping',
  sorting: 'при активной сортировке порядком строк владеет сортировка',
  noToolbar: 'без enableToolbar у плагина нет поверхности',
  noActions: 'нечего показать: ни один плагин не добавил действий',
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
