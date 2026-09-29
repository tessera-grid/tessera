import type { PluginInertReason } from '../../core/pluginDiagnostics'

/** Без тулбара нет кнопки «Колонки» — единственного способа вернуть скрытое (CV19). */
export const columnVisibilityInertReason = (
  table: unknown,
): PluginInertReason | undefined =>
  (table as { options: { enableToolbar?: boolean } }).options.enableToolbar
    ? undefined
    : 'noToolbar'
