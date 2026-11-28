/** Подписи `columnFiltering` (ADR 0182, §8): ключи словаря таблицы `columnFiltering.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnFilteringLabels {
  /** Transform kind in the list of the "Columns" menu (ADR 0204) */
  transformName: string
  /** Filter of a hidden column — in the accessible name of its item */
  transformDescription: string
  /** Filter button in the header and the filter panel's label (`columnFiltering`) */
  filter: string
  /** Accessible name of the filter button when the column filter is active */
  filterActive: string
  /** Condition select in the filter panel */
  filterCondition: string
  /** Value field in the filter panel */
  filterValue: string
  /** Lower bound of the "between" condition */
  filterFrom: string
  /** Upper bound of the "between" condition */
  filterTo: string
  /** Button that clears the column filter */
  filterReset: string
  /** Filter panel button in server mode: submit the condition (ADR 0154) */
  filterApply: string
  /** Number field error: the input doesn't parse as a number */
  filterInvalidNumber: string
  filterContains: string
  filterEquals: string
  filterNotEquals: string
  filterStartsWith: string
  filterEndsWith: string
  filterLessThan: string
  filterLessThanOrEqual: string
  filterGreaterThan: string
  filterGreaterThanOrEqual: string
  filterBetween: string
  filterEmpty: string
  filterNotEmpty: string
  /** Boolean filter: no filter */
  filterAll: string
  filterYes: string
  filterNo: string
  /** Date filter (ADR 0047): conditions, presets, time field, month paging */
  filterOn: string
  filterBefore: string
  filterAfter: string
  filterPreset: string
  filterPresetToday: string
  filterPresetYesterday: string
  filterPresetLast7Days: string
  filterPresetLast30Days: string
  filterPresetThisMonth: string
  filterPresetThisYear: string
  filterTime: string
  filterTimeFrom: string
  filterTimeTo: string
  /** Option filter (ADR 0048): conditions, checklist, lookup loading */
  filterAnyOf: string
  filterAllOf: string
  filterNoneOf: string
  filterSearchOptions: string
  filterSelectAll: string
  filterClearSelection: string
  filterNoOptions: string
  filterLoadingOptions: string
  filterOptionsError: string
  filterRetry: string
  /** A filter draft that removes the condition. */
  draftNoFilter: string
  /**
   * Filter summary button in the toolbar: tooltip and accessible name — with no active filters,
   * with active ones (`count`) and with active ones on hidden columns (`hidden`)
   */
  filters: string
  /** Button that clears one filter in the summary */
  removeFilter: (column: string) => string
  /** Action: set column filters */
  actionSetFilters: string
  /** Action: remove a column filter */
  actionRemoveFilter: string
  /** Action: remove all filters */
  actionClearFilters: string
}

export const columnFilteringLabels = defineLabels<ColumnFilteringLabels>()(
  'columnFiltering',
  {
    filter: 'Filter',
    filterActive: 'Filter, active',
    filterCondition: 'Condition',
    filterValue: 'Value',
    filterFrom: 'From',
    filterTo: 'To',
    filterReset: 'Reset',
    filterApply: 'Apply',
    filterInvalidNumber: 'Enter a number',
    filterContains: 'Contains',
    filterEquals: 'Equals',
    filterNotEquals: 'Does not equal',
    filterStartsWith: 'Starts with',
    filterEndsWith: 'Ends with',
    filterLessThan: 'Less than',
    filterLessThanOrEqual: 'Less than or equal to',
    filterGreaterThan: 'Greater than',
    filterGreaterThanOrEqual: 'Greater than or equal to',
    filterBetween: 'Between',
    filterEmpty: 'Is empty',
    filterNotEmpty: 'Is not empty',
    filterAll: 'All',
    filterYes: 'Yes',
    filterNo: 'No',
    filterOn: 'On',
    filterBefore: 'Before',
    filterAfter: 'After',
    filterPreset: 'Period',
    filterPresetToday: 'Today',
    filterPresetYesterday: 'Yesterday',
    filterPresetLast7Days: 'Last 7 days',
    filterPresetLast30Days: 'Last 30 days',
    filterPresetThisMonth: 'This month',
    filterPresetThisYear: 'This year',
    filterTime: 'Time',
    filterTimeFrom: 'Time from',
    filterTimeTo: 'Time to',
    filterAnyOf: 'Any of',
    filterAllOf: 'All of',
    filterNoneOf: 'None of',
    filterSearchOptions: 'Search values',
    filterSelectAll: 'Select all',
    filterClearSelection: 'Clear selection',
    filterNoOptions: 'No values',
    filterLoadingOptions: 'Loading…',
    filterOptionsError: "Couldn't load values",
    filterRetry: 'Retry',
    draftNoFilter: 'No filter',
    filters: 'Filters',
    removeFilter: 'Remove filter: {column}',
    actionSetFilters: 'Set filters',
    actionRemoveFilter: 'Remove a filter',
    actionClearFilters: 'Clear filters',
    transformName: 'filter',
    transformDescription: 'filtered',
  },
  {
    removeFilter: ['column'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnFiltering: typeof columnFilteringLabels
  }
}
