/** Подписи `columnSorting` (ADR 0182, §8): ключи словаря таблицы `columnSorting.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnSortingLabels {
  /** Tooltip "sort ascending" */
  sortAscending: string
  /** Tooltip "sort descending" */
  sortDescending: string
  /** Tooltip "clear sorting" */
  clearSort: string
  /** Column menu item: the next multi-sort level (ADR 0231, §7) */
  addToSorting: string
  /**
   * Accessible name of a column's priority in multi-sort (`position` of `total`, 1-based). It
   * goes into the button's `aria-label` — screen readers don't read the numeric priority badge,
   * so the sort order is spoken here.
   */
  sortPriority: (position: number, total: number) => string
  /** Action: sort a column */
  actionSort: string
  /** Transform kind in the list of the "Columns" menu (ADR 0204) */
  transformName: string
  /** Ascending sort of a hidden column — in the accessible name of its item */
  transformAscending: string
  /** The same, descending */
  transformDescending: string
  /** Sort priority of a hidden column (`position` of `total`) */
  transformPriority: (position: number, total: number) => string
  /** Sort summary button in the toolbar and its popover title (ADR 0204, §5) */
  sorting: string
  /** Remove a column's sort level in the summary */
  removeSort: (column: string) => string
  /** Clear all sorting in the summary */
  resetSorting: string
}

export const columnSortingLabels = defineLabels<ColumnSortingLabels>()(
  'columnSorting',
  {
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    clearSort: 'Clear sorting',
    addToSorting: 'Add to sorting',
    sortPriority: 'Sort priority {position} of {total}',
    actionSort: 'Sort',
    transformName: 'sorting',
    transformAscending: 'sorted ascending',
    transformDescending: 'sorted descending',
    transformPriority: 'priority {position} of {total}',
    sorting: 'Sorting',
    removeSort: 'Remove sorting: {column}',
    resetSorting: 'Reset sorting',
  },
  {
    sortPriority: ['position', 'total'],
    transformPriority: ['position', 'total'],
    removeSort: ['column'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnSorting: typeof columnSortingLabels
  }
}
