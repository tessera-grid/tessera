/**
 * Сравнение значения ячейки по типу колонки (ADR 0221, §3): равенство до форматирования и
 * направление смены у чисел, десятичных строк и дат.
 */
import { dateTypeInstant, objectKeyOf } from '../../core/dataTypeFormat'
import type { ResolvedDataType } from '../../core/dataTypes'
import type { FlashOutcome } from '../../core/flashes/flashFeature'
import { compareDecimal, parseDecimal } from '../../util/decimal'

export interface CompareColumn {
  id: string
  getDataType: () => ResolvedDataType | undefined
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === ''

/** Порядок двух значений колонки; `undefined` — несравнимы. */
const order = (
  type: ResolvedDataType | undefined,
  a: unknown,
  b: unknown,
): number | undefined => {
  if (isEmpty(a) || isEmpty(b)) return undefined
  switch (type?.base) {
    case 'number':
      return typeof a === 'number' &&
        typeof b === 'number' &&
        !Number.isNaN(a) &&
        !Number.isNaN(b)
        ? Math.sign(a - b)
        : undefined
    case 'numberString': {
      const x = parseDecimal(String(a))
      const y = parseDecimal(String(b))
      return x && y ? Math.sign(compareDecimal(x, y)) : undefined
    }
    case 'date':
    case 'dateTime':
    case 'dateString':
    case 'dateTimeString': {
      const x = dateTypeInstant(type, a)
      const y = dateTypeInstant(type, b)
      return x === undefined || y === undefined ? undefined : Math.sign(x - y)
    }
    default:
      return undefined
  }
}

/** Одинаковы ли значения ячейки по типу колонки. */
export const sameCellValue = (
  table: unknown,
  column: CompareColumn,
  a: unknown,
  b: unknown,
): boolean => {
  if (Object.is(a, b)) return true
  const type = column.getDataType()
  switch (type?.base) {
    case 'multiSelect':
      return (
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((item, i) => Object.is(item, b[i]))
      )
    case 'object':
      return Object.is(
        objectKeyOf(table as never, column as never, a),
        objectKeyOf(table as never, column as never, b),
      )
    case 'number':
    case 'numberString':
    case 'date':
    case 'dateTime':
    case 'dateString':
    case 'dateTimeString':
      return order(type, a, b) === 0
    default:
      return a instanceof Date && b instanceof Date
        ? a.getTime() === b.getTime()
        : false
  }
}

/** Итог смены: рост и падение — только с `direction`, иначе и у несравнимых — `changed`. */
export const changeOutcome = (
  column: CompareColumn,
  previous: unknown,
  next: unknown,
  direction: boolean,
): FlashOutcome => {
  if (!direction) return 'changed'
  const sign = order(column.getDataType(), next, previous)
  return sign === 1 ? 'up' : sign === -1 ? 'down' : 'changed'
}
