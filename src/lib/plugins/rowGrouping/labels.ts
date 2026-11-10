/** Подписи `rowGrouping` (ADR 0182, §8): ключи словаря таблицы `rowGrouping.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowGroupingLabels {
  /** Тултип кнопки группировки */
  group: string
  /** Тултип кнопки разгруппировки */
  ungroup: string
  /** Вид преобразования в перечне меню «Колонки» (ADR 0204) */
  transformName: string
  /** Группировка по скрытой колонке — в доступном имени её пункта */
  transformDescription: string
  /** Уровень группировки скрытой колонки (`position` из `total`) */
  transformLevel: (position: number, total: number) => string
}

export const rowGroupingLabels = defineLabels<RowGroupingLabels>()(
  'rowGrouping',
  {
    group: 'Group',
    ungroup: 'Ungroup',
    transformName: 'grouping',
    transformDescription: 'grouped',
    transformLevel: 'level {position} of {total}',
  },
  {
    transformLevel: ['position', 'total'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowGrouping: typeof rowGroupingLabels
  }
}
