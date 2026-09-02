import {
  DEFAULT_ROW_ACTIONS_OPTIONS,
  ROW_ACTIONS_COLUMN_ID,
  getRowActionsColumn,
} from '../../core/createColumns/createRowActionsColumn'
import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'

export interface RowActionsPluginOptions extends PluginOptions {
  /** Ширина колонки действий, px (по умолчанию 120). */
  width?: number
}

// Прагматичный сплит (ADR 0010): наружу opt-in — только фабрика-запись; сама
// колонка действий, её автосайз и предикаты `getIsActionsColumn` остаются
// always-on инфраструктурой ядра (плагин импортит их из core — стрелка вверх,
// R1-чисто). Полный вынос механики в плагин — отдельная задача.
export const rowActions = (
  opts: RowActionsPluginOptions = {},
): RegistryEntry => ({
  id: 'rowActions',
  enabled: opts.enabled,
  feature: {},
  column: {
    id: ROW_ACTIONS_COLUMN_ID,
    make: getRowActionsColumn as ServiceColumn['make'],
    side: 'trailing',
    order: 0,
    // Колонка действий закреплена всегда вправо — политику объявляет запись.
    pin: { side: 'right', when: 'always' },
  },
  options: {
    enableRowActions: true,
    rowActionsOptions: {
      ...DEFAULT_ROW_ACTIONS_OPTIONS,
      ...(opts.width != null ? { width: opts.width } : {}),
    },
  },
})
