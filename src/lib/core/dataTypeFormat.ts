/**
 * Текст значения по типу колонки (ADR 0172, §3): формат `Intl` на языке таблицы,
 * `formatValue` главнее; умолчания нейтральны к языку — число как есть, дата `YYYY-MM-DD`,
 * дата со временем `YYYY-MM-DD HH:mm` в поясе таблицы. Форматтеры — раз на язык, пояс и
 * опции (DT20).
 */
import { optionTextOf, type ColumnOptionsDef } from './columnOptions'
import { DEFAULT_LOCALE } from './localization'
import {
  type DataTypeAlign,
  type DataTypeFormat,
  type DataTypeName,
  resolveDataType,
  type ResolvedDataType,
  type DataTypeFields,
  type DataTypeRegistry,
} from './dataTypes'

interface FormatTable {
  options: { dataTypes?: DataTypeRegistry; locale?: string; timeZone?: string }
}

export interface FormatColumn {
  id: string
  columnDef: ColumnOptionsDef & { dataType?: DataTypeName } & DataTypeFields
}

type Formatter = Intl.NumberFormat | Intl.DateTimeFormat

const byOptions = new WeakMap<object, Map<string, Formatter>>()
const NO_OPTIONS = {}

const formatterOf = <TKind extends 'number' | 'date'>(
  kind: TKind,
  options: DataTypeFormat | undefined,
  locale: string,
  timeZone: string | undefined,
): TKind extends 'number' ? Intl.NumberFormat : Intl.DateTimeFormat => {
  const source = options ?? NO_OPTIONS
  let byKey = byOptions.get(source)
  if (!byKey) byOptions.set(source, (byKey = new Map()))
  const key = `${kind}|${locale}|${timeZone ?? ''}`
  let formatter = byKey.get(key)
  if (!formatter) {
    formatter =
      kind === 'number'
        ? new Intl.NumberFormat(locale, options)
        : new Intl.DateTimeFormat(locale, { timeZone, ...options })
    byKey.set(key, formatter)
  }
  return formatter as never
}

/** Части даты по поясу: нейтральный вид `YYYY-MM-DD` и `HH:mm`. */
const PARTS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
} as const satisfies Intl.DateTimeFormatOptions

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

const neutralDate = (
  date: Date,
  withTime: boolean,
  timeZone: string | undefined,
) => {
  const key = timeZone ?? ''
  let formatter = partsFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { ...PARTS, timeZone })
    partsFormatters.set(key, formatter)
  }
  const part: Record<string, string> = {}
  for (const { type, value } of formatter.formatToParts(date)) {
    part[type] = value
  }
  const day = `${part.year}-${part.month}-${part.day}`
  return withTime ? `${day} ${part.hour}:${part.minute}` : day
}

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})/

/** Момент значения даты; `undefined` — значение не дата этого типа. */
const instantOf = (value: unknown, base: string): Date | undefined => {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  if (typeof value !== 'string') return undefined
  // Дата без времени — сутки в UTC: так её читает `Date` и пишет выгрузка.
  const date =
    base === 'dateString' && DATE_ONLY.test(value)
      ? new Date(`${value.slice(0, 10)}T00:00:00Z`)
      : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === ''

const dateText = (
  value: unknown,
  type: ResolvedDataType,
  locale: string,
  timeZone: string | undefined,
): string => {
  const { base, definition } = type
  // Дата-строка без своего формата показывается как лежит в данных.
  if (
    base === 'dateString' &&
    !definition.format &&
    typeof value === 'string'
  ) {
    const day = DATE_ONLY.exec(value)
    if (day) return day[1]!
  }
  const instant = instantOf(
    definition.parseDate ? definition.parseDate(value) : value,
    base,
  )
  if (!instant) return String(value)
  const zone = base === 'dateString' ? 'UTC' : timeZone
  if (definition.format) {
    return formatterOf('date', definition.format, locale, zone).format(instant)
  }
  return neutralDate(
    instant,
    base === 'dateTime' || base === 'dateTimeString',
    zone,
  )
}

const DATE_BASES = new Set(['date', 'dateTime', 'dateString', 'dateTimeString'])

/**
 * Момент значения колонки с типом даты, в миллисекундах; свой формат — `parseDate` типа.
 * `undefined` — не дата или пусто (DT10, DT13).
 */
export const dateTypeInstant = (
  type: ResolvedDataType | undefined,
  value: unknown,
): number | undefined => {
  if (!type || !DATE_BASES.has(type.base) || isEmpty(value)) return undefined
  const parsed = type.definition.parseDate
    ? type.definition.parseDate(value)
    : value
  return instantOf(parsed, type.base)?.getTime()
}

/** Текст значения колонки по её типу (DT4, DT5, DT7). */
export const formatDataTypeValue = (
  table: FormatTable,
  column: FormatColumn,
  value: unknown,
  row: unknown,
): string => {
  const type = resolveDataType(table, column)
  if (type?.definition.formatValue)
    return type.definition.formatValue(value, row)
  const options = optionTextOf(table, column, value)
  if (options !== undefined) return options
  if (isEmpty(value)) return ''
  const { locale = DEFAULT_LOCALE, timeZone } = table.options
  if (!type) {
    // Без типа — как раньше; объект `Date` — как `dateTime`.
    return value instanceof Date
      ? neutralDate(value, true, timeZone)
      : String(value)
  }
  switch (type.base) {
    case 'number':
      return typeof value === 'number' && type.definition.format
        ? formatterOf(
            'number',
            type.definition.format,
            locale,
            undefined,
          ).format(value)
        : String(value)
    case 'date':
    case 'dateTime':
    case 'dateString':
    case 'dateTimeString':
      return dateText(value, type, locale, timeZone)
    case 'multiSelect':
      return Array.isArray(value) ? value.join(', ') : String(value)
    default:
      return String(value)
  }
}

/** Выравнивание колонки: своё у колонки или типа, у `number` — `end` (DT9). */
export const alignOf = (
  table: FormatTable,
  column: FormatColumn,
): DataTypeAlign | undefined => {
  const type = resolveDataType(table, column)
  return type?.definition.align ?? (type?.base === 'number' ? 'end' : undefined)
}
