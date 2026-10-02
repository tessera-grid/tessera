/**
 * Подписи условий и текст фильтра для панели и сводки (ADR 0045, §4–§5).
 */
import type { TableLabels } from '../../core/localization'
import type {
  ColumnFilterValue,
  NumberFilterOperator,
  TextFilterOperator,
} from './types'

export type FilterOperator = TextFilterOperator | NumberFilterOperator

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
}

export const operatorLabel = (operator: FilterOperator, labels: TableLabels) =>
  labels[OPERATOR_LABEL[operator]] as string

/** Условие и значение одной строкой: «Contains "ali"», «Between 25–30», «Yes». */
export const describeFilter = (
  filter: ColumnFilterValue,
  labels: TableLabels,
): string => {
  if (!('value' in filter)) {
    return operatorLabel(filter.operator, labels)
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
