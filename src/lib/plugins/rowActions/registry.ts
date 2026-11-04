/**
 * Запись плагина rowActions на `definePlugin`. Сервисная колонка
 * действий закреплена вправо (pin side `end`). `setup` (generic-escape): ширина
 * колонки следует за подачей действий (схлопнуты в кебаб rowActionMenu →
 * collapsedWidth) через `table.setColumnAutoSizing`; факт «слот схлопнут» читаем из
 * общей опции actionMenu.
 */
import { definePlugin } from '../../core/definePlugin'
import { noSlotActionsReason } from '../../core/pluginDiagnostics'
import type { ServiceColumnMode } from '../../core/servicePresence'
import type { SlotActionMenu } from '../../core/headerActions'
import type { ColumnSizingState, Updater } from '../../types'
import { rowActionsLabels } from './labels'
import {
  DEFAULT_ROW_ACTIONS_OPTIONS,
  ROW_ACTIONS_COLUMN_ID,
  getRowActionsColumn,
} from './rowActionsColumn'

export interface RowActionsPluginOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Ширина колонки действий, px (по умолчанию 120). */
  width?: number
  /** Ширина при схлопнутых действиях (кебаб rowActionMenu, по умолчанию 56). */
  collapsedWidth?: number
  /**
   * `'auto'` (по умолчанию) — колонка видна, только если плагины добавили действия
   * строки; `'always'` — всегда (ADR 0050).
   */
  column?: ServiceColumnMode
}

type RowActionsTable = {
  options: { actionMenu?: SlotActionMenu }
  setColumnAutoSizing?: (updater: Updater<ColumnSizingState>) => void
}

export const rowActions = definePlugin<RowActionsPluginOptions>()({
  id: 'rowActions',
  labels: [rowActionsLabels],
  diagnose: table => noSlotActionsReason(table, ['actionRowSlot']),
  features: {},
  column: {
    id: ROW_ACTIONS_COLUMN_ID,
    make: getRowActionsColumn,
    side: 'trailing',
    order: 0,
    // Колонка действий закреплена всегда справа (логическая сторона end в v9).
    pin: { side: 'end', when: 'always' },
    label: labels => rowActionsLabels(labels).rowActionsColumn,
    fill: true,
    // То же условие, что у диагностики 'noActions'.
    presence: (_table, context) =>
      (context.slotActions.actionRowSlot?.length ?? 0) > 0,
  },
  setup: o => table => {
    const width = o.width ?? DEFAULT_ROW_ACTIONS_OPTIONS.width
    const collapsedWidth =
      o.collapsedWidth ?? DEFAULT_ROW_ACTIONS_OPTIONS.collapsedWidth
    const t = table as RowActionsTable
    const isCollapsed = !!t.options.actionMenu?.actionRowSlot
    t.setColumnAutoSizing?.(prev => ({
      ...prev,
      [ROW_ACTIONS_COLUMN_ID]: isCollapsed ? collapsedWidth : width,
    }))
  },
})
