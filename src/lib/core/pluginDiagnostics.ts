/**
 * Снимок активности подключённых плагинов (`table.getPluginDiagnostics()`,
 * ADR 0022, PC12–PC14). Считается на момент вызова по текущему состоянию, а не по
 * мере рендера: инертен ли плагин, решает его `diagnose` — та же проверка, что
 * гасит его `getCan*`.
 */
/** Почему подключённый плагин сейчас ничего не делает. */
export type PluginInertReason =
  'disabled' | 'multiLevelHeader' | 'grouping' | 'sorting' | (string & {})

export type PluginDiagnostic =
  | { id: string; status: 'active' }
  | { id: string; status: 'inert'; reason: PluginInertReason }

/** Проверка плагина: причина инертности или `undefined`, если плагин работает. */
export type PluginDiagnose = (table: unknown) => PluginInertReason | undefined

export interface PluginDiagnosticSource {
  id: string
  enabled?: boolean
  diagnose?: PluginDiagnose
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
