/**
 * Запись плагина rowActions на `definePlugin`. Сервисная колонка
 * действий закреплена вправо (pin side `end`). `setup` (generic-escape): ширина
 * колонки следует за подачей действий (схлопнуты в кебаб rowActionMenu →
 * collapsedWidth) через `table.setColumnAutoSizing`; факт «слот схлопнут» читаем из
 * общей опции actionMenu.
 */
import { ROW_ACTIONS_COLUMN_ID } from '../../core/createColumns/actionColumnParams'
import { definePlugin } from '../../core/definePlugin'
import type { SlotActionMenu } from '../../core/headerActions'
import type { ColumnSizingState, Updater } from '../../types'
import {
  DEFAULT_ROW_ACTIONS_OPTIONS,
  getRowActionsColumn,
} from './rowActionsColumn'

export interface RowActionsPluginOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Ширина колонки действий, px (по умолчанию 120). */
  width?: number
  /** Ширина при схлопнутых действиях (кебаб rowActionMenu, по умолчанию 56). */
  collapsedWidth?: number
}

type RowActionsTable = {
  options: { actionMenu?: SlotActionMenu }
  setColumnAutoSizing?: (updater: Updater<ColumnSizingState>) => void
}

export const rowActions = definePlugin<RowActionsPluginOptions>()({
  id: 'rowActions',
  features: {},
  column: {
    id: ROW_ACTIONS_COLUMN_ID,
    make: getRowActionsColumn,
    side: 'trailing',
    order: 0,
    // Колонка действий закреплена всегда справа (логическая сторона end в v9).
    pin: { side: 'end', when: 'always' },
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
