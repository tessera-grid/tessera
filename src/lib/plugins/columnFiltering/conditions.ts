/**
 * Условия фильтров колонок (ADR 0045, §3): чистые функции над значением ячейки.
 * Значение, которое условие не может применить (пустой текст, нечисловая граница),
 * фильтром не считается — строка проходит.
 */
import type {
  BooleanFilter,
  ColumnFilterDef,
  ColumnFilterType,
  ColumnFilterValue,
  NumberFilter,
  TextFilter,
} from './types'

/** Задержка применения ввода в панели фильтра по умолчанию (ADR 0045, §4). */
export const DEFAULT_FILTER_DEBOUNCE_MS = 200

export const isEmptyValue = (value: unknown) =>
  value === null || value === undefined || value === ''

export const filterTypeOf = (
  def: ColumnFilterDef | undefined,
): ColumnFilterType | undefined => (typeof def === 'object' ? def.type : def)

const normalize = (text: string) => text.trim().toLowerCase()

export const matchesText = (value: unknown, filter: TextFilter): boolean => {
  if (filter.operator === 'empty') return isEmptyValue(value)
  if (filter.operator === 'notEmpty') return !isEmptyValue(value)
  const query = normalize(filter.value)
  if (query === '') return true
  if (isEmptyValue(value)) return false
  const text = String(value).toLowerCase()
  switch (filter.operator) {
    case 'contains':
      return text.includes(query)
    case 'equals':
      return text === query
    case 'startsWith':
      return text.startsWith(query)
    case 'endsWith':
      return text.endsWith(query)
  }
}

const toNumber = (value: unknown): number =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN

const isBound = (bound: number | null): bound is number =>
  typeof bound === 'number' && Number.isFinite(bound)

export const matchesNumber = (
  value: unknown,
  filter: NumberFilter,
): boolean => {
  if (filter.operator === 'empty') return isEmptyValue(value)
  if (filter.operator === 'notEmpty') return !isEmptyValue(value)
  const n = toNumber(value)
  if (filter.operator === 'between') {
    const [from, to] = filter.value
    if (!isBound(from) && !isBound(to)) return true
    return (!isBound(from) || n >= from) && (!isBound(to) || n <= to)
  }
  if (!isBound(filter.value)) return true
  switch (filter.operator) {
    case 'equals':
      return n === filter.value
    case 'notEquals':
      return !Number.isNaN(n) && n !== filter.value
    case 'lessThan':
      return n < filter.value
    case 'lessThanOrEqual':
      return n <= filter.value
    case 'greaterThan':
      return n > filter.value
    case 'greaterThanOrEqual':
      return n >= filter.value
  }
}

export const matchesBoolean = (
  value: unknown,
  filter: BooleanFilter,
): boolean =>
  filter.operator === 'empty'
    ? value === null || value === undefined
    : value === filter.value

/** Значение ячейки проходит фильтр колонки своего типа. */
export const matchesColumnFilter = (
  type: ColumnFilterType,
  value: unknown,
  filter: ColumnFilterValue,
): boolean => {
  switch (type) {
    case 'text':
      return matchesText(value, filter as TextFilter)
    case 'number':
      return matchesNumber(value, filter as NumberFilter)
    case 'boolean':
      return matchesBoolean(value, filter as BooleanFilter)
  }
}

/** Фильтр ничего не отбирает — срез его не хранит (стоковый `autoRemove`). */
export const isInactiveFilter = (filter: unknown): boolean => {
  if (!filter || typeof filter !== 'object') return true
  const { operator, value } = filter as { operator?: unknown; value?: unknown }
  if (operator === 'empty' || operator === 'notEmpty') return false
  if (operator === 'between') {
    const [from, to] = (value as [number | null, number | null]) ?? []
    return !isBound(from ?? null) && !isBound(to ?? null)
  }
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'number') return !Number.isFinite(value)
  return typeof value !== 'boolean'
}
