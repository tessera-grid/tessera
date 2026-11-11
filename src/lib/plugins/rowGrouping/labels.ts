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
  /** Кнопка-сводка группировки в тулбаре и заголовок её поповера (ADR 0204, §5) */
  grouping: string
  /** Снять уровень группировки колонки в сводке */
  removeGrouping: (column: string) => string
  /** Сбросить всю группировку в сводке */
  resetGrouping: string
}

export const rowGroupingLabels = defineLabels<RowGroupingLabels>()(
  'rowGrouping',
  {
    group: 'Group',
    ungroup: 'Ungroup',
    transformName: 'grouping',
    transformDescription: 'grouped',
    transformLevel: 'level {position} of {total}',
    grouping: 'Grouping',
    removeGrouping: 'Remove grouping: {column}',
    resetGrouping: 'Reset grouping',
  },
  {
    transformLevel: ['position', 'total'],
    removeGrouping: ['column'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowGrouping: typeof rowGroupingLabels
  }
}
