/** Подписи `rowSelection` (ADR 0182, §8): ключи словаря таблицы `rowSelection.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowSelectionLabels {
  /** Accessible name of the row selection checkbox */
  selectRow: string
  /** Accessible name of the select-all checkbox */
  selectAll: string
  /** Accessible name of a group row checkbox: select the whole group (ADR 0148) */
  selectGroup: string
  /** Short counter forms in a narrow status bar (ADR 0083, TX6); never truncated */
  selectedRowsShort: (count: number) => string
  selectedRowsHiddenShort: (count: number) => string
  /** Selected row counter in the status bar (`rowSelection({ selectedCount })`) */
  selectedRows: (count: number) => string
  /** Addition to the selected counter: selected rows hidden by a filter (ADR 0045) */
  selectedRowsHidden: (count: number) => string
  /** Action: select all rows of the page */
  actionToggleAllPageRows: string
}

export const rowSelectionLabels = defineLabels<RowSelectionLabels>()(
  'rowSelection',
  {
    selectRow: 'Select row',
    selectAll: 'Select all rows',
    selectGroup: 'Select group',
    selectedRows: '{count} rows selected',
    selectedRows_one: '{count} row selected',
    selectedRowsHidden: '{count} hidden by filters',
    selectedRowsShort: '{count} selected',
    selectedRowsHiddenShort: '{count} hidden',
    actionToggleAllPageRows: 'Select all on the page',
  },
  {
    selectedRowsShort: ['count'],
    selectedRowsHiddenShort: ['count'],
    selectedRows: ['count'],
    selectedRowsHidden: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowSelection: typeof rowSelectionLabels
  }
}
