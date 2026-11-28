/** Подписи `columnPinning` (ADR 0182, §8): ключи словаря таблицы `columnPinning.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnPinningLabels {
  /** Tooltip of the pin column button */
  pin: string
  /** Tooltip of the unpin column button */
  unpin: string
  /** Menu item / toggle "pin left" */
  pinLeft: string
  /** Menu item / toggle "pin right" */
  pinRight: string
}

export const columnPinningLabels = defineLabels<ColumnPinningLabels>()(
  'columnPinning',
  {
    pin: 'Pin column',
    unpin: 'Unpin column',
    pinLeft: 'Pin left',
    pinRight: 'Pin right',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnPinning: typeof columnPinningLabels
  }
}
