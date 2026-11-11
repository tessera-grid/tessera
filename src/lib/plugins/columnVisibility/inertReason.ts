import type { PluginInertReason } from '../../core/pluginDiagnostics'

/**
 * Тулбар запрещён или «Настройки вида» сняты `viewSettingsToolbar: false` — нет раздела «Колонки», единственного
 * способа вернуть скрытое (PB7; ADR 0215, VW9).
 */
export const columnVisibilityInertReason = (
  table: unknown,
): PluginInertReason | undefined =>
  (table as { options: { enableToolbar?: boolean } }).options.enableToolbar ===
    false ||
  (table as { options: { viewSettingsToolbar?: unknown } }).options
    .viewSettingsToolbar === false
    ? 'noToolbar'
    : undefined
