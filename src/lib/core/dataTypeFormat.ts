/**
 * Текст значения по типу колонки (ADR 0172, §3): формат `Intl` на языке таблицы,
 * `formatValue` главнее; умолчания нейтральны к языку — число как есть, дата `YYYY-MM-DD`,
 * дата со временем `YYYY-MM-DD HH:mm` в поясе таблицы. Форматтеры — раз на язык, пояс и
 * опции (DT20).
 */
import {
  hasColumnOptions,
  optionTextOf,
  type ColumnOptionsDef,
} from './columnOptions'
import { DEFAULT_LOCALE } from './localization'
import { parseDecimal } from '../util/decimal'
import { logWarn } from '../util/logger'
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Ключ записи по определению типа; значение не запись — само значение (TY1). */
const recordKey = (definition: DataTypeFields, value: unknown): unknown => {
  if (!isRecord(value)) return value
  return definition.getKey ? definition.getKey(value) : value.id
}

/** Подпись записи: `getLabel`, иначе `label`, `name`, ключ строкой (TY1). */
export const objectLabelOf = (
  definition: DataTypeFields,
  value: unknown,
): string => {
  if (isEmpty(value)) return ''
  if (!isRecord(value)) return String(value)
  if (definition.getLabel) return definition.getLabel(value)
  const label = value.label ?? value.name ?? recordKey(definition, value)
  return label === undefined || label === null ? '' : String(label)
}

/**
 * Ключ значения колонки записи `object`; у прочих колонок — само значение. Запись без
 * ключа — предупреждение в dev, раз на колонку (TY1).
 */
export const objectKeyOf = (
  table: FormatTable,
  column: FormatColumn,
  value: unknown,
): unknown => {
  const type = resolveDataType(table, column)
  if (type?.base !== 'object' || isEmpty(value)) return value
  return checkedKey(table, column, type.definition, value)
}

const checkedKey = (
  table: FormatTable,
  column: FormatColumn,
  definition: DataTypeFields,
  value: unknown,
) => {
  const key = recordKey(definition, value)
  if (key === undefined || key === null) {
    logWarn(
      table as never,
      `dataType object: column "${column.id}" has a record without a key — set getKey on the column or its type`,
      `dataType-object-key:${column.id}`,
    )
  }
  return key
}

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

/** Текст значения по уже разрешённому типу колонки — общее тело форматирования. */
const formatTyped = (
  table: FormatTable,
  column: FormatColumn,
  type: ResolvedDataType | undefined,
  value: unknown,
  row: unknown,
): string => {
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
    case 'numberString':
      // Строку `Intl` форматирует без перевода во float (TY9).
      return type.definition.format &&
        (typeof value === 'number' || parseDecimal(value))
        ? formatterOf(
            'number',
            type.definition.format,
            locale,
            undefined,
          ).format(value as number)
        : String(value)
    case 'multiSelect':
      return Array.isArray(value) ? value.join(', ') : String(value)
    case 'object':
      checkedKey(table, column, type.definition, value)
      return objectLabelOf(type.definition, value)
    default:
      return String(value)
  }
}

/** Текст значения колонки по её типу (DT4, DT5, DT7). */
export const formatDataTypeValue = (
  table: FormatTable,
  column: FormatColumn,
  value: unknown,
  row: unknown,
): string =>
  formatTyped(table, column, resolveDataType(table, column), value, row)

/** Функции агрегата, которые считают строки, а не значения колонки (ADR 0230, §5). */
const COUNTING_AGGREGATIONS: readonly unknown[] = ['count', 'uniqueCount']

const INTEGER: Intl.NumberFormatOptions = { maximumFractionDigits: 0 }

/**
 * Значение агрегата колонки — итог или значение строки-группы (ADR 0230, §5): у счётной функции —
 * целое число по языку таблицы, иначе — текст по типу колонки.
 */
export const formatAggregateValue = (
  table: FormatTable,
  column: FormatColumn & { columnDef: { aggregationFn?: unknown } },
  value: unknown,
  row: unknown,
): string =>
  typeof value === 'number' &&
  COUNTING_AGGREGATIONS.includes(column.columnDef.aggregationFn)
    ? formatterOf(
        'number',
        INTEGER,
        table.options.locale ?? DEFAULT_LOCALE,
        undefined,
      ).format(value)
    : formatDataTypeValue(table, column, value, row)

/**
 * Форматтер колонки с типом, разрешённым один раз (ADR 0201, §4): тот же текст, что
 * `formatDataTypeValue`, без разрешения типа на каждое значение.
 */
export const columnFormatter = (table: FormatTable, column: FormatColumn) => {
  const type = resolveDataType(table, column)
  if (!type && !hasColumnOptions(column.columnDef)) {
    // Без типа и вариантов — строка значения, как у `formatTyped`, без проверок на каждое.
    const { timeZone } = table.options
    return (value: unknown): string =>
      typeof value === 'string'
        ? value
        : value === null || value === undefined
          ? ''
          : value instanceof Date
            ? neutralDate(value, true, timeZone)
            : String(value)
  }
  return (value: unknown, row: unknown): string =>
    formatTyped(table, column, type, value, row)
}

/** Числа — `number` и десятичная строка `numberString`: цифры одной ширины. */
export const isNumericBase = (base: string | undefined) =>
  base === 'number' || base === 'numberString'

/** Выравнивание колонки: своё у колонки или типа; по умолчанию — к началу (DT9). */
export const alignOf = (
  table: FormatTable,
  column: FormatColumn,
): DataTypeAlign | undefined => resolveDataType(table, column)?.definition.align
