/** Подписи `columnPinning` (ADR 0182, §8): ключи словаря таблицы `columnPinning.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnPinningLabels {
  /** Тултип кнопки закрепления колонки */
  pin: string
  /** Тултип кнопки открепления колонки */
  unpin: string
  /** Пункт меню / тумблер «закрепить слева» */
  pinLeft: string
  /** Пункт меню / тумблер «закрепить справа» */
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
