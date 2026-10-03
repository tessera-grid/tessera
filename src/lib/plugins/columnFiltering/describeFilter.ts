/**
 * Подписи условий и текст фильтра для панели и сводки (ADR 0045, §4–§5); даты —
 * через `Intl.DateTimeFormat` в локали календаря (ADR 0047, §6).
 */
import type { TableLabels } from '../../core/localization'
import { parseFilterDate } from './dates'
import type {
  ColumnFilterValue,
  DateFilterOperator,
  DateFilterPreset,
  NumberFilterOperator,
  TextFilterOperator,
} from './types'

export type FilterOperator =
  TextFilterOperator | NumberFilterOperator | DateFilterOperator

export const OPERATOR_LABEL: Record<FilterOperator, keyof TableLabels> = {
  contains: 'filterContains',
  equals: 'filterEquals',
  notEquals: 'filterNotEquals',
  startsWith: 'filterStartsWith',
  endsWith: 'filterEndsWith',
  lessThan: 'filterLessThan',
  lessThanOrEqual: 'filterLessThanOrEqual',
  greaterThan: 'filterGreaterThan',
  greaterThanOrEqual: 'filterGreaterThanOrEqual',
  between: 'filterBetween',
  empty: 'filterEmpty',
  notEmpty: 'filterNotEmpty',
  on: 'filterOn',
  before: 'filterBefore',
  after: 'filterAfter',
  preset: 'filterPreset',
}

export const PRESET_LABEL: Record<DateFilterPreset, keyof TableLabels> = {
  today: 'filterPresetToday',
  yesterday: 'filterPresetYesterday',
  last7Days: 'filterPresetLast7Days',
  last30Days: 'filterPresetLast30Days',
  thisMonth: 'filterPresetThisMonth',
  thisYear: 'filterPresetThisYear',
}

/**
 * `'YYYY-MM-DD'` / `'YYYY-MM-DDTHH:mm'` в локали календаря (по умолчанию `en-US`, как
 * календарь, а не локаль браузера); стенное время выводится как есть.
 */
export const formatFilterDate = (value: string, locale = 'en-US'): string => {
  const bound = parseFilterDate(value)
  if (!bound) return value
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: bound.hasTime ? 'short' : undefined,
      timeZone: 'UTC',
    }).format(bound.wall * 60_000)
  } catch {
    return value
  }
}

const DATE_OPERATORS = new Set<string>(['on', 'before', 'after', 'preset'])

const isDateFilter = (filter: ColumnFilterValue) =>
  DATE_OPERATORS.has(filter.operator) ||
  (filter.operator === 'between' &&
    filter.value.some(bound => typeof bound === 'string'))

export const operatorLabel = (operator: FilterOperator, labels: TableLabels) =>
  labels[OPERATOR_LABEL[operator]] as string

/**
 * Условие и значение одной строкой: «Contains "ali"», «Between 25–30», «Yes»,
 * «On Oct 3, 2026», «Today».
 */
export const describeFilter = (
  filter: ColumnFilterValue,
  labels: TableLabels,
  locale?: string,
): string => {
  if (!('value' in filter)) {
    return operatorLabel(filter.operator, labels)
  }
  if (isDateFilter(filter)) {
    if (filter.operator === 'preset') {
      return labels[PRESET_LABEL[filter.value]] as string
    }
    if (Array.isArray(filter.value)) {
      const [from, to] = filter.value as (string | null)[]
      const shown = (bound: string | null) =>
        bound === null ? '…' : formatFilterDate(bound, locale)
      return `${operatorLabel('between', labels)} ${shown(from)} – ${shown(to)}`
    }
    return `${operatorLabel(filter.operator, labels)} ${formatFilterDate(String(filter.value), locale)}`
  }
  const { value } = filter
  if (typeof value === 'boolean') {
    return value ? labels.filterYes : labels.filterNo
  }
  if (Array.isArray(value)) {
    const [from, to] = value
    return `${operatorLabel('between', labels)} ${from ?? '…'}–${to ?? '…'}`
  }
  const shown = typeof value === 'string' ? `"${value.trim()}"` : String(value)
  return `${operatorLabel(filter.operator as FilterOperator, labels)} ${shown}`
}
