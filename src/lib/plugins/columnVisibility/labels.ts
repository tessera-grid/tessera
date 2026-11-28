/** Подписи `columnVisibility` (ADR 0182, §8): ключи словаря таблицы `columnVisibility.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnVisibilityLabels {
  /** Toolbar button and accessible name of the columns menu (`columnVisibility`) */
  columns: string
  /** Short value of the "Columns" section of "View settings": nothing is hidden (ADR 0215) */
  columnsAllVisible: string
  /** Short value of the "Columns" section of "View settings": how many columns are hidden */
  columnsHiddenShort: (count: number) => string
  /** Placeholder and accessible name of the search in the columns menu */
  searchColumns: string
  /** Columns menu text when the search found nothing */
  noColumnsFound: string
  /** Button of the "all columns hidden" stub: show all columns */
  showAllColumns: string
  /** Root checkbox of the columns menu tree: show or hide all */
  allColumns: string
  /** Columns menu footer: how many columns are visible */
  selectedColumns: (count: number) => string
  /** Button that resets column visibility to the initial state */
  resetColumns: string
  /** Header kebab item: hide the column */
  hideColumn: string
  /** Kebab item of a nested header group: hide the group */
  hideGroup: string
  /** Stub: all columns are hidden (ADR 0123) */
  columnsHiddenTitle: string
  /** Action: show or hide a column */
  actionToggleColumn: string
  /** Action: remove the sort, filter and grouping of a hidden column (ADR 0204, HT4) */
  actionClearTransforms: string
  /** A hidden column's item in the accessible name (ADR 0204, HT3) */
  hiddenColumn: string
  /** Hint on a just-hidden column's item: its transforms (`list`) remain */
  transformsKept: (list: readonly string[], count: number) => string
  /** Hint of the "Hide column" kebab item: transforms will remain */
  transformsWillRemain: (list: readonly string[], count: number) => string
  /** Tooltip of the eraser button on a hidden column: what applies to it now (`transforms`) and what pressing does */
  activeTransforms: (transforms: string) => string
  /** Announcement: columns (`columns`) were hidden, their transforms (`list`) remain */
  columnsHiddenKept: (
    columns: readonly string[],
    list: readonly string[],
    count: number,
  ) => string
}

export const columnVisibilityLabels = defineLabels<ColumnVisibilityLabels>()(
  'columnVisibility',
  {
    columns: 'Columns',
    columnsAllVisible: 'all visible',
    columnsHiddenShort: '{count} hidden',
    searchColumns: 'Find column',
    noColumnsFound: 'No columns found',
    showAllColumns: 'Show all',
    allColumns: 'All columns',
    selectedColumns: '{count} columns selected',
    selectedColumns_one: '{count} column selected',
    resetColumns: 'Reset',
    hideColumn: 'Hide column',
    hideGroup: 'Hide group',
    columnsHiddenTitle: 'All columns are hidden',
    actionToggleColumn: 'Show or hide a column',
    actionClearTransforms: 'Clear sorting, filter and grouping of a column',
    hiddenColumn: 'hidden',
    transformsKept: '{list} remain',
    transformsKept_one: '{list} remains',
    transformsWillRemain: '{list} will remain',
    activeTransforms: '{transforms}. Click to clear',
    columnsHiddenKept: '{columns} hidden, {list} remain',
    columnsHiddenKept_one: '{columns} hidden, {list} remains',
  },
  {
    columnsHiddenShort: ['count'],
    selectedColumns: ['count'],
    transformsKept: ['list', 'count'],
    transformsWillRemain: ['list', 'count'],
    activeTransforms: ['transforms'],
    columnsHiddenKept: ['columns', 'list', 'count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnVisibility: typeof columnVisibilityLabels
  }
}
