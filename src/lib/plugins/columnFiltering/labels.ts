/** Подписи `columnFiltering` (ADR 0182, §8): ключи словаря таблицы `columnFiltering.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnFilteringLabels {
  /** Вид преобразования в перечне меню «Колонки» (ADR 0204) */
  transformName: string
  /** Фильтр скрытой колонки — в доступном имени её пункта */
  transformDescription: string
  /** Кнопка фильтра в заголовке и подпись панели фильтра (`columnFiltering`) */
  filter: string
  /** Доступное имя кнопки фильтра при активном фильтре колонки */
  filterActive: string
  /** Поле выбора условия в панели фильтра */
  filterCondition: string
  /** Поле значения в панели фильтра */
  filterValue: string
  /** Нижняя граница условия «между» */
  filterFrom: string
  /** Верхняя граница условия «между» */
  filterTo: string
  /** Кнопка сброса фильтра колонки */
  filterReset: string
  /** Кнопка панели фильтра в серверном режиме: отправить условие (ADR 0154) */
  filterApply: string
  /** Ошибка поля числа: ввод не разбирается как число */
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
  /** Булев фильтр: без фильтра */
  filterAll: string
  filterYes: string
  filterNo: string
  /** Фильтр дат (ADR 0047): условия, пресеты, поле времени, листание месяцев */
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
  /** Фильтр вариантов (ADR 0048): условия, чек-лист, загрузка справочника */
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
  /** Черновик фильтра, который снимает условие. */
  draftNoFilter: string
  /**
   * Кнопка-сводка фильтров в тулбаре: тултип и доступное имя — без активных фильтров, с
   * активными (`count`) и с активными на скрытых колонках (`hidden`)
   */
  filters: string
  /** Кнопка сброса одного фильтра в сводке */
  removeFilter: (column: string) => string
  /** Действие: задать фильтры колонок */
  actionSetFilters: string
  /** Действие: снять фильтр колонки */
  actionRemoveFilter: string
  /** Действие: снять все фильтры */
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
