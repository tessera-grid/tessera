import type { PluginInertReason } from '../../core/pluginDiagnostics'

/** Тулбар запрещён — нет кнопки «Колонки», единственного способа вернуть скрытое (PB7). */
export const columnVisibilityInertReason = (
  table: unknown,
): PluginInertReason | undefined =>
  (table as { options: { enableToolbar?: boolean } }).options.enableToolbar ===
  false
    ? 'noToolbar'
    : undefined
