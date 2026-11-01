/**
 * Сортировка по типу данных колонки (ADR 0172, DT10): текст — `Intl.Collator` языка таблицы
 * с числами по значению и без учёта регистра, числа, сначала `false`, даты — по моменту,
 * даты-строки — разбором, свой формат — `parseDate` типа; пустые — последними в обе стороны.
 * Запись `object` — по подписи (ADR 0174, TY3), десятичная строка — без float (TY10). Колонку с вариантами сортирует подпись
 * (ADR 0063), свою функцию колонки фича не трогает.
 */
import { constructSortFn } from '@tanstack/react-table'

import { hasColumnOptions } from '../../core/columnOptions'
import { dateTypeInstant, objectLabelOf } from '../../core/dataTypeFormat'
import type { ResolvedDataType } from '../../core/dataTypes'
import { DEFAULT_LOCALE } from '../../core/localization'
import { compareDecimal, type Decimal, parseDecimal } from '../../util/decimal'

export interface TypedSortColumn {
  table: { options: { locale?: string } }
  columnDef: {
    sortFn?: unknown
    invertSorting?: boolean
    options?: unknown
    getOptionLabel?: unknown
  }
  getIsSorted: () => false | 'asc' | 'desc'
  getDataType: () => ResolvedDataType | undefined
}

const EMPTY = Symbol('empty')

const collators = new Map<string, Intl.Collator>()

/** Сравнение текста языка: числа по значению, регистр и диакритика не различаются. */
export const collatorOf = (locale = DEFAULT_LOCALE) => {
  let collator = collators.get(locale)
  if (!collator) {
    collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
    collators.set(locale, collator)
  }
  return collator
}

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

const keyOf = (type: ResolvedDataType | undefined, value: unknown) => {
  if (isEmpty(value)) return EMPTY
  switch (type?.base) {
    case 'number': {
      const number = typeof value === 'number' ? value : Number(value)
      return Number.isNaN(number) ? EMPTY : number
    }
    case 'boolean':
      return value ? 1 : 0
    case 'date':
    case 'dateTime':
    case 'dateString':
    case 'dateTimeString':
      return dateTypeInstant(type, value) ?? EMPTY
    case 'multiSelect':
      return Array.isArray(value) ? value.join(', ') : String(value)
    case 'object':
      return objectLabelOf(type.definition, value) || EMPTY
    case 'numberString':
      return parseDecimal(value) ?? EMPTY
    default:
      return String(value)
  }
}

export const typedSortFn = (column: TypedSortColumn) =>
  constructSortFn({
    resolveDataValue: (value: unknown) => keyOf(column.getDataType(), value),
    sort: (a: unknown, b: unknown) => {
      const emptyA = a === EMPTY
      const emptyB = b === EMPTY
      if (emptyA || emptyB) {
        // Модель обращает результат по убыванию и при invertSorting — заранее
        // обращаем, чтобы пустые остались внизу.
        const flipped =
          (column.getIsSorted() === 'desc') !== !!column.columnDef.invertSorting
        const order = Number(emptyA) - Number(emptyB)
        return flipped ? -order : order
      }
      if (typeof a === 'number' && typeof b === 'number') return a - b
      if (typeof a === 'object' && typeof b === 'object') {
        return compareDecimal(a as Decimal, b as Decimal)
      }
      return collatorOf(column.table.options.locale).compare(
        String(a),
        String(b),
      )
    },
  } as never)

/** Колонке с типом без своей функции сортировки ставит сортировку по типу. */
export const typedSortFeature = {
  initColumnInstanceData: (column: TypedSortColumn) => {
    const { columnDef } = column
    if (
      columnDef.sortFn === 'auto' &&
      column.getDataType() !== undefined &&
      !hasColumnOptions(columnDef as never)
    ) {
      columnDef.sortFn = typedSortFn(column)
    }
  },
}
