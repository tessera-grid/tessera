import { parseLocaleNumber } from '../util/parseNumber'
import type { ColumnOption } from './columnOptions'
import type { BuiltInDataType } from './dataTypes'

/**
 * Тип данных колонки (ADR 0139): разбор текста редактора в значение того же вида, что
 * лежит в данных.
 */

/**
 * Вид разбора: `'date'` и `'dateTime'` — объект `Date`, `'dateString'` — строка
 * `YYYY-MM-DD`, `'dateTimeString'` — ISO со временем, `'select'` — значение варианта по
 * подписи, `'object'` — запись: её пишет только свой `parseValue` (ADR 0174, TY8).
 */
export type ColumnDataType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'dateTime'
  | 'dateString'
  | 'dateTimeString'
  | 'select'
  | 'object'

/** Язык чисел и варианты колонки — для разбора по типу (DT14). */
export interface ParseContext {
  locale?: string
  options?: readonly ColumnOption[]
}

/** Тип по прежнему значению ячейки: число, булево или `Date`, иначе текст. */
export const inferDataType = (value: unknown): ColumnDataType =>
  typeof value === 'number'
    ? 'number'
    : typeof value === 'boolean'
      ? 'boolean'
      : value instanceof Date
        ? 'date'
        : 'text'

/** Разбор правки по базовому типу (ADR 0172, DT14); `multiSelect` — текстом. */
export const parseKindOf = (base: BuiltInDataType): ColumnDataType =>
  base === 'multiSelect' ? 'text' : base

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Разобрать текст редактора; `undefined` — текст не разбирается в этот тип. */
export const parseByDataType = (
  text: string,
  type: ColumnDataType,
  { locale, options }: ParseContext = {},
): { value: unknown } | undefined => {
  if (type === 'text') return { value: text }
  if (type === 'object') return undefined
  const trimmed = text.trim()
  if (trimmed === '') return { value: null }
  switch (type) {
    case 'number': {
      const value = parseLocaleNumber(trimmed, locale)
      return value !== null && Number.isFinite(value) ? { value } : undefined
    }
    case 'select': {
      const lower = trimmed.toLowerCase()
      const option =
        options?.find(item => item.label.toLowerCase() === lower) ??
        options?.find(item => String(item.value) === trimmed)
      return option ? { value: option.value } : undefined
    }
    case 'dateTime':
    case 'dateTimeString': {
      const date = new Date(trimmed)
      if (Number.isNaN(date.getTime())) return undefined
      return { value: type === 'dateTime' ? date : date.toISOString() }
    }
    case 'boolean': {
      const lower = trimmed.toLowerCase()
      if (lower === 'true') return { value: true }
      if (lower === 'false') return { value: false }
      return undefined
    }
    case 'date':
    case 'dateString': {
      // Дата без времени — день в UTC, как её читает `Date`.
      if (type === 'dateString' && DATE_ONLY.test(trimmed)) {
        return { value: trimmed }
      }
      const date = new Date(trimmed)
      if (Number.isNaN(date.getTime())) return undefined
      return {
        value: type === 'date' ? date : date.toISOString().slice(0, 10),
      }
    }
  }
}

/** Записать значение по пути `accessorKey` (`a.b` — вглубь), не трогая прочие поля. */
export const setAtPath = (
  row: unknown,
  path: string,
  value: unknown,
): unknown => {
  const [head, ...rest] = path.split('.')
  const source = (row ?? {}) as Record<string, unknown>
  return {
    ...source,
    [head!]:
      rest.length === 0
        ? value
        : setAtPath(source[head!], rest.join('.'), value),
  }
}
