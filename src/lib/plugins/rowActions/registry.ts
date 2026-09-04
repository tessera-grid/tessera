import { ROW_ACTIONS_COLUMN_ID } from '../../core/createColumns'
import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'
import { DEFAULT_ROW_ACTIONS_OPTIONS, getRowActionsColumn } from './rowActionsColumn'

export interface RowActionsPluginOptions extends PluginOptions {
  /** Ширина колонки действий, px (по умолчанию 120). */
  width?: number
}

// rowActions полностью в плагине (ADR 0010): колонка, её опции и автосайз живут
// здесь. Ширина применяется через generic-механизм ядра `table.setColumnAutoSizing`
// (авто-слайс, который побеждает даже контролируемый columnSizing), а плагин
// вызывает его в `setup` — обобщённом escape ядра для императивного сетапа. В
// ядре остаётся лишь id колонки (ROW_ACTIONS_COLUMN_ID) + предикаты, т.к. их
// безусловно читает grid.
export const rowActions = (
  opts: RowActionsPluginOptions = {},
): RegistryEntry => {
  const width = opts.width ?? DEFAULT_ROW_ACTIONS_OPTIONS.width

  return {
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
    setup: table => {
      table.setColumnAutoSizing?.(prev => ({
        ...prev,
        [ROW_ACTIONS_COLUMN_ID]: width,
      }))
    },
  }
}
