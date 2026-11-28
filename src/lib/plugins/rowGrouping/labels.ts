/** Подписи `rowGrouping` (ADR 0182, §8): ключи словаря таблицы `rowGrouping.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowGroupingLabels {
  /** Tooltip of the group button */
  group: string
  /** Tooltip of the ungroup button */
  ungroup: string
  /** Transform kind in the list of the "Columns" menu (ADR 0204) */
  transformName: string
  /** Grouping by a hidden column — in the accessible name of its item */
  transformDescription: string
  /** Grouping level of a hidden column (`position` of `total`) */
  transformLevel: (position: number, total: number) => string
  /** Grouping summary button in the toolbar and its popover title (ADR 0204, §5) */
  grouping: string
  /** Remove a column's grouping level in the summary */
  removeGrouping: (column: string) => string
  /** Clear all grouping in the summary */
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
