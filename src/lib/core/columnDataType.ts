import type { BuiltInDataType } from './dataTypes'

/**
 * Тип данных колонки (ADR 0139): разбор текста редактора в значение того же вида, что
 * лежит в данных.
 */

/** `'date'` — объект `Date`, `'dateString'` — строка `YYYY-MM-DD`. */
export type ColumnDataType =
  'text' | 'number' | 'boolean' | 'date' | 'dateString'

/** Тип по прежнему значению ячейки: число, булево или `Date`, иначе текст. */
export const inferDataType = (value: unknown): ColumnDataType =>
  typeof value === 'number'
    ? 'number'
    : typeof value === 'boolean'
      ? 'boolean'
      : value instanceof Date
        ? 'date'
        : 'text'

/** Разбор правки по базовому типу (ADR 0172): прочие базовые типы — текстом до этапа 2. */
export const parseKindOf = (base: BuiltInDataType): ColumnDataType =>
  base === 'dateTime'
    ? 'date'
    : base === 'number' ||
        base === 'boolean' ||
        base === 'date' ||
        base === 'dateString'
      ? base
      : 'text'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Разобрать текст редактора; `undefined` — текст не разбирается в этот тип. */
export const parseByDataType = (
  text: string,
  type: ColumnDataType,
): { value: unknown } | undefined => {
  if (type === 'text') return { value: text }
  const trimmed = text.trim()
  if (trimmed === '') return { value: null }
  switch (type) {
    case 'number': {
      const value = Number(trimmed)
      return Number.isFinite(value) ? { value } : undefined
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
