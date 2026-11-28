/** Подписи `rowSelectionModel` (ADR 0182, §8): ключи словаря таблицы `rowSelectionModel.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowSelectionModelLabels {
  /** Announcement of the number of selected rows */
  announceSelection: (count: number) => string
  /** "All selected except k" when the server doesn't know the data rows in the result set (ADR 0144, §5) */
  selectedAllExcept: (count: number) => string
  selectedAllExceptShort: (count: number) => string
  /**
   * Groups are selected without their row counts (ADR 0148, §3): "12 rows and 2 groups"; `groups`
   * is the `selectedGroupsCount` label, with zero rows — only that
   */
  selectedRowsAndGroups: (count: number, groups: string) => string
  selectedRowsAndGroupsShort: (count: number, groups: string) => string
  selectedGroupsCount: (count: number) => string
  /** Tree branches selected without their row counts (ADR 0162, §4): "2 branches" */
  selectedBranchesCount: (count: number) => string
}

export const rowSelectionModelLabels = defineLabels<RowSelectionModelLabels>()(
  'rowSelectionModel',
  {
    announceSelection: '{count} rows selected',
    announceSelection_one: '{count} row selected',
    selectedAllExcept: 'All selected except {count}',
    selectedAllExcept_zero: 'All selected',
    selectedAllExceptShort: 'All except {count}',
    selectedAllExceptShort_zero: 'All',
    selectedRowsAndGroups: '{count} rows and {groups} selected',
    selectedRowsAndGroups_one: '{count} row and {groups} selected',
    selectedRowsAndGroups_zero: '{groups} selected',
    selectedRowsAndGroupsShort: '{count} + {groups}',
    selectedRowsAndGroupsShort_zero: '{groups}',
    selectedGroupsCount: '{count} groups',
    selectedGroupsCount_one: '{count} group',
    selectedBranchesCount: '{count} branches',
    selectedBranchesCount_one: '{count} branch',
  },
  {
    announceSelection: ['count'],
    selectedAllExcept: ['count'],
    selectedAllExceptShort: ['count'],
    selectedRowsAndGroups: ['count', 'groups'],
    selectedRowsAndGroupsShort: ['count', 'groups'],
    selectedGroupsCount: ['count'],
    selectedBranchesCount: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowSelectionModel: typeof rowSelectionModelLabels
  }
}
