/**
 * Раздел «Колонки» «Настроек вида» (ADR 0215, §1): короткое значение — сколько колонок скрыто; своя панель —
 * меню колонок в ленивом модуле. Открывается всегда, даже когда ничего не скрыто.
 */
import { type ViewSettingsSection } from '../../core/viewSettings'
import { preloadable } from '../../util/preloadable'
import { getShowAll, type VisibilityTable } from './columnTree'
import { columnVisibilityLabels } from './labels'

const hiddenCount = (table: unknown) =>
  getShowAll(table as VisibilityTable).length

export const columnsSection: ViewSettingsSection = {
  id: 'columns',
  order: 40,
  plugin: 'columnVisibility',
  icon: 'columns',
  slices: ['columnVisibility'],
  label: labels => columnVisibilityLabels(labels).columns,
  active: table => hiddenCount(table) > 0,
  value: (table, labels) => {
    const hidden = hiddenCount(table)
    return hidden === 0
      ? columnVisibilityLabels(labels).columnsAllVisible
      : columnVisibilityLabels(labels).columnsHiddenShort(hidden)
  },
  panel: preloadable(() =>
    import('./ColumnVisibilitySection').then(
      module => module.ColumnVisibilitySection,
    ),
  ),
}
