import { ROW_ACTIONS_COLUMN_ID } from '../../core/createColumns'
import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'
import {
  DEFAULT_ROW_ACTIONS_OPTIONS,
  getRowActionsColumn,
} from './rowActionsColumn'

export interface RowActionsPluginOptions extends PluginOptions {
  /** Ширина колонки действий, px (по умолчанию 120). */
  width?: number
  /**
   * Ширина колонки, когда действия строки схлопнуты в кебаб плагином
   * `rowActionMenu` (по умолчанию 56 — под один ⋮). См. ADR 0024.
   */
  collapsedWidth?: number
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
  const collapsedWidth =
    opts.collapsedWidth ?? DEFAULT_ROW_ACTIONS_OPTIONS.collapsedWidth

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
    // Ширина следует за подачей действий: если `rowActionMenu` схлопывает
    // `actionRowSlot` в кебаб — колонке нужен лишь один ⋮, поэтому сужаем её
    // (иначе фиксированная ширина под ряд кнопок оставляла бы пустоту). `setup`
    // перезапускается при смене активного набора, так что toggle меню меняет
    // ширину без перезагрузки. Владелец ширины — плагин колонки; читаем лишь факт
    // «слот схлопнут» из общей опции `actionMenu`, не внутренности соседа.
    setup: table => {
      const isCollapsed = !!table.options.actionMenu?.actionRowSlot
      table.setColumnAutoSizing?.(prev => ({
        ...prev,
        [ROW_ACTIONS_COLUMN_ID]: isCollapsed ? collapsedWidth : width,
      }))
    },
  }
}
