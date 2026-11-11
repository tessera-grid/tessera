/**
 * Запись плагина columnVisibility на `definePlugin` (ADR 0035). Своей фичи нет:
 * видимость — стоковый срез `columnVisibility` ядра. Плагин добавляет раздел «Колонки»
 * «Настроек вида» (ADR 0215), «Скрыть колонку» в кебаб заголовка и
 * бизнес-колбэк; заглушка «все колонки скрыты» (ADR 0123).
 */
import { definePlugin } from '../../core/definePlugin'
import { COLUMNS_HIDDEN_STUB } from './columnsHiddenStub'
import { hideHeaderAction } from './hideHeaderAction'
import { columnVisibilityInertReason } from './inertReason'
import type { ColumnVisibilityHooks } from './types'
import { columnVisibilityLabels } from './labels'
import { columnsSection } from './viewSettingsSection'

export interface ColumnVisibilityOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк: пользователь показал или скрыл колонки из меню. */
  onToggleColumnVisibility?: ColumnVisibilityHooks['onToggleColumnVisibility']
}

export const columnVisibility = definePlugin<ColumnVisibilityOptions>()({
  id: 'columnVisibility',
  labels: [columnVisibilityLabels],
  actions: {
    reset: labels => columnVisibilityLabels(labels).resetColumns,
    searchColumns: labels => columnVisibilityLabels(labels).searchColumns,
    toggleAll: labels => columnVisibilityLabels(labels).allColumns,
    toggleColumn: labels => columnVisibilityLabels(labels).actionToggleColumn,
    hide: labels => columnVisibilityLabels(labels).hideColumn,
    hideGroup: labels => columnVisibilityLabels(labels).hideGroup,
    clearTransforms: labels =>
      columnVisibilityLabels(labels).actionClearTransforms,
  },
  diagnose: columnVisibilityInertReason,
  hooks: o => ({ onToggleColumnVisibility: o.onToggleColumnVisibility }),
  slotActions: [hideHeaderAction],
  stubs: [COLUMNS_HIDDEN_STUB],
  // Меню колонок — раздел «Настроек вида» (ADR 0215, §3).
  viewSettingsSections: [columnsSection],
})
