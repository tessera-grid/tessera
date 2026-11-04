/**
 * Подписи условий и текст фильтра для панели и сводки (ADR 0045, §4–§5); даты —
 * через `Intl.DateTimeFormat` в локали календаря (ADR 0047, §6).
 */
import type { TableLabels } from '../../core/localization'
import { parseFilterDate } from '../columnFilteringModel/dates'
import type {
  ColumnFilterValue,
  DateFilterOperator,
  DateFilterPreset,
  NumberFilterOperator,
  OptionFilterOperator,
  TextFilterOperator,
} from '../columnFilteringModel/types'
import { type ColumnFilteringLabels, columnFilteringLabels } from './labels'

export type FilterOperator =
  | TextFilterOperator
  | NumberFilterOperator
  | DateFilterOperator
  | OptionFilterOperator

export const OPERATOR_LABEL: Record<
  FilterOperator,
  keyof ColumnFilteringLabels
> = {
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
  anyOf: 'filterAnyOf',
  allOf: 'filterAllOf',
  noneOf: 'filterNoneOf',
}

export const PRESET_LABEL: Record<
  DateFilterPreset,
  keyof ColumnFilteringLabels
> = {
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
const OPTION_OPERATORS = new Set<string>(['anyOf', 'allOf', 'noneOf'])

/** Подписей вариантов в строке сводки; остальные — «+N». */
const SHOWN_OPTIONS = 2

export interface DescribeContext {
  /** Локаль дат (`dateLocale.code`), по умолчанию `en-US`. */
  locale?: string
  /** Подпись значения варианта (ADR 0048, §4). */
  optionLabel?: (value: unknown) => string
  /** Число по типу колонки (ADR 0172, DT8). */
  numberText?: (value: number) => string
}

const isDateFilter = (filter: ColumnFilterValue) =>
  DATE_OPERATORS.has(filter.operator) ||
  (filter.operator === 'between' &&
    filter.value.some(bound => typeof bound === 'string'))

export const operatorLabel = (operator: FilterOperator, labels: TableLabels) =>
  columnFilteringLabels(labels)[OPERATOR_LABEL[operator]] as string

/**
 * Условие и значение одной строкой: «Contains "ali"», «Between 25–30», «Yes»,
 * «On Oct 3, 2026», «Today», «Any of: Lead, Won +2».
 */
export const describeFilter = (
  filter: ColumnFilterValue,
  labels: TableLabels,
  { locale, optionLabel = String, numberText = String }: DescribeContext = {},
): string => {
  const bound = (value: unknown) =>
    typeof value === 'number' ? numberText(value) : (value ?? '…')
  if (!('value' in filter)) {
    return operatorLabel(filter.operator, labels)
  }
  if (OPTION_OPERATORS.has(filter.operator)) {
    const values = filter.value as unknown[]
    const shown = values.slice(0, SHOWN_OPTIONS).map(optionLabel).join(', ')
    const rest = values.length - SHOWN_OPTIONS
    return `${operatorLabel(filter.operator, labels)}: ${shown}${rest > 0 ? ` +${rest}` : ''}`
  }
  if (isDateFilter(filter)) {
    if (filter.operator === 'preset') {
      return columnFilteringLabels(labels)[PRESET_LABEL[filter.value]] as string
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
    return value
      ? columnFilteringLabels(labels).filterYes
      : columnFilteringLabels(labels).filterNo
  }
  if (Array.isArray(value)) {
    const [from, to] = value
    return `${operatorLabel('between', labels)} ${bound(from)}–${bound(to)}`
  }
  const shown =
    typeof value === 'string' ? `"${value.trim()}"` : String(bound(value))
  return `${operatorLabel(filter.operator as FilterOperator, labels)} ${shown}`
}
