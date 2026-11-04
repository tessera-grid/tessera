/** Подписи `rowGrouping` (ADR 0182, §8): ключи словаря таблицы `rowGrouping.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowGroupingLabels {
  /** Тултип кнопки группировки */
  group: string
  /** Тултип кнопки разгруппировки */
  ungroup: string
}

export const rowGroupingLabels = defineLabels<RowGroupingLabels>()(
  'rowGrouping',
  {
    group: 'Group',
    ungroup: 'Ungroup',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowGrouping: typeof rowGroupingLabels
  }
}
