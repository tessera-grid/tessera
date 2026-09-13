/**
 * Фаза E — запись плагина rowActions для v9 (порт registry.ts, ADR 0025/0010).
 *
 * Отличия от v8:
 *  - сервисная колонка действий закреплена вправо: pin side `right`→`end`;
 *  - `setup` (generic-escape) сохранён: ширина колонки следует за подачей действий
 *    (схлопнуты в кебаб rowActionMenu → collapsedWidth) через table.setColumnAutoSizing;
 *    читаем факт «слот схлопнут» из общей опции actionMenu.
 */
import { ROW_ACTIONS_COLUMN_ID } from '../../../lib/core/createColumns/actionColumnParams'
import type { ServiceColumn } from '../../core/createColumns'
import type { TesseraFeatureEntry } from '../../core/features'
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

export const rowActions = (opts: RowActionsPluginOptions = {}) => {
  const width = opts.width ?? DEFAULT_ROW_ACTIONS_OPTIONS.width
  const collapsedWidth =
    opts.collapsedWidth ?? DEFAULT_ROW_ACTIONS_OPTIONS.collapsedWidth

  return {
    id: 'rowActions',
    enabled: opts.enabled,
    slot: {},
    column: {
      id: ROW_ACTIONS_COLUMN_ID,
      make: getRowActionsColumn,
      side: 'trailing',
      order: 0,
      // Колонка действий закреплена всегда справа (логическая сторона end в v9).
      pin: { side: 'end', when: 'always' },
    } satisfies ServiceColumn,
    setup: (table: unknown) => {
      const t = table as RowActionsTable
      const isCollapsed = !!t.options.actionMenu?.actionRowSlot
      t.setColumnAutoSizing?.(prev => ({
        ...prev,
        [ROW_ACTIONS_COLUMN_ID]: isCollapsed ? collapsedWidth : width,
      }))
    },
  } satisfies TesseraFeatureEntry
}
