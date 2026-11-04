/** Подписи `rowSelectionModel` (ADR 0182, §8): ключи словаря таблицы `rowSelectionModel.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowSelectionModelLabels {
  /** Объявление числа выбранных строк */
  announceSelection: (count: number) => string
  /** «Выбрано всё, кроме k», когда строк данных в выборке не знает сервер (ADR 0144, §5) */
  selectedAllExcept: (count: number) => string
  selectedAllExceptShort: (count: number) => string
  /**
   * Выбраны группы без числа их строк (ADR 0148, §3): «12 строк и 2 группы»; `groups` —
   * подпись `selectedGroupsCount`, при нуле строк — только она
   */
  selectedRowsAndGroups: (count: number, groups: string) => string
  selectedRowsAndGroupsShort: (count: number, groups: string) => string
  selectedGroupsCount: (count: number) => string
  /** Ветки дерева, выбранные без числа их строк (ADR 0162, §4): «2 ветки» */
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
