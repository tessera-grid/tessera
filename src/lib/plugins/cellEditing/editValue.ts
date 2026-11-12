/**
 * Значение правки в типе колонки (ADR 0175, §1–§2): текст значения для поля по языку
 * таблицы, разбор набранного текста по типу и сравнение с исходным значением.
 */
import {
  inferDataType,
  optionByText,
  parseByDataType,
  parseKindOf,
} from './columnDataType'
import { announcerLabels } from '../../core/announcer'
import { ENGLISH_LABELS } from '../../core/localization'
import type { ColumnOption } from '../../core/columnOptions'
import type { ResolvedDataType } from '../../core/dataTypes'
import {
  formatDataTypeValue,
  objectKeyOf,
  objectLabelOf,
} from '../../core/dataTypeFormat'
import { compareDecimal, parseDecimal } from '../../util/decimal'

export interface EditColumn {
  columnDef: {
    options?: ColumnOption[]
    parseValue?: (text: string, row: unknown) => unknown
  }
  getDataType: () => ResolvedDataType | undefined
}

export interface EditTable {
  getColumn?: (id: string) => EditColumn | undefined
  options: { locale?: string; timeZone?: string }
}

const DEFAULT_LOCALE = 'en-US'

/** Без поля ввода: текст значения — как в ячейке. */
const SHOWN_BASES: readonly string[] = [
  'date',
  'dateTime',
  'dateString',
  'dateTimeString',
  'select',
  'multiSelect',
  'object',
]

/** Число в поле — десятичный знак языка таблицы, без разрядов и округления (ED4). */
const numberText = (value: number | string, locale: string) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 100,
    useGrouping: false,
  }).format(value as number)

export const columnOf = (table: unknown, columnId: string) =>
  (table as EditTable).getColumn?.(columnId)

/**
 * Текст значения в правке: числа — по языку таблицы, даты и варианты — как в ячейке,
 * остальное — как есть.
 */
export const editTextOf = (
  table: unknown,
  columnId: string,
  value: unknown,
): string => {
  if (value === null || value === undefined) return ''
  const column = columnOf(table, columnId)
  const base = column?.getDataType()?.base
  if (base && SHOWN_BASES.includes(base))
    return formatDataTypeValue(
      table as never,
      column as never,
      value,
      undefined,
    )
  const locale = (table as EditTable).options.locale ?? DEFAULT_LOCALE
  if (base === 'number' && typeof value === 'number' && Number.isFinite(value))
    return numberText(value, locale)
  if (base === 'numberString' && parseDecimal(value))
    return numberText(String(value).trim(), locale)
  return String(value)
}

/**
 * Разбор набранного текста: свой `parseValue` колонки или типа главнее, иначе — по базовому
 * типу, без типа — по прежнему значению ячейки (ADR 0139, ED2). `undefined` — не разбирается.
 */
export const parseEditText = (
  table: unknown,
  columnId: string,
  text: string,
  row: { original: unknown; current: unknown },
): { value: unknown } | undefined => {
  const column = columnOf(table, columnId)
  const type = column?.getDataType()
  const parse = type?.definition.parseValue ?? column?.columnDef.parseValue
  if (parse) return { value: parse(text, row.original) }
  if (type?.base === 'object') return recordByLabel(table, columnId, text)
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  return parseByDataType(
    text,
    type ? parseKindOf(type.base) : inferDataType(row.current),
    {
      locale: (table as EditTable).options.locale,
      timeZone: (table as EditTable).options.timeZone,
      options: column?.columnDef.options,
      booleanLabels: { yes: labels.booleanTrue, no: labels.booleanFalse },
      current: row.current,
    },
  )
}

type RecordsTable = EditTable & {
  getRowSource?: () => {
    loadedRows: () => Iterable<{ getValue: (columnId: string) => unknown }>
  }
}

/** Подписи записей колонки `object` в загруженных строках — раз на список строк и колонку. */
const recordLabels = new WeakMap<object, Map<string, Map<string, unknown>>>()

/**
 * Запись `object` по подписи (ADR 0219, WR5): среди `options` с `record`, иначе среди
 * записей колонки в загруженных строках, как редактор (ED8, ED17). Пустой текст — пусто.
 */
const recordByLabel = (
  table: unknown,
  columnId: string,
  text: string,
): { value: unknown } | undefined => {
  const trimmed = text.trim()
  if (trimmed === '') return { value: null }
  const column = columnOf(table, columnId)!
  const definition = column.getDataType()!.definition
  const option = optionByText(column.columnDef.options, trimmed)
  if (option)
    return option.record !== undefined ? { value: option.record } : undefined
  const rows = (table as RecordsTable).getRowSource?.().loadedRows()
  if (!rows) return undefined
  let byColumn = recordLabels.get(rows)
  if (!byColumn) recordLabels.set(rows, (byColumn = new Map()))
  let byLabel = byColumn.get(columnId)
  if (!byLabel) {
    byLabel = new Map()
    for (const row of rows) {
      const value = row.getValue(columnId)
      if (value === null || value === undefined) continue
      const label = objectLabelOf(definition, value).toLowerCase()
      if (!byLabel.has(label)) byLabel.set(label, value)
    }
    byColumn.set(columnId, byLabel)
  }
  const record = byLabel.get(trimmed.toLowerCase())
  return record === undefined ? undefined : { value: record }
}

const isBlank = (value: unknown) =>
  value === null || value === undefined || value === ''

/** Значение не изменилось: пустые равны, даты — по времени, записи — по ключу (SS18). */
export const sameEditValue = (
  table: unknown,
  columnId: string,
  value: unknown,
  original: unknown,
): boolean => {
  if (isBlank(value) && isBlank(original)) return true
  if (Object.is(value, original)) return true
  if (value instanceof Date && original instanceof Date)
    return value.getTime() === original.getTime()
  if (Array.isArray(value) && Array.isArray(original))
    return (
      value.length === original.length &&
      value.every((item, i) => Object.is(item, original[i]))
    )
  const column = columnOf(table, columnId)
  const base = column?.getDataType()?.base
  if (base === 'object' && value && original)
    return Object.is(
      objectKeyOf(table as never, column as never, value),
      objectKeyOf(table as never, column as never, original),
    )
  if (base === 'numberString') {
    const a = parseDecimal(value)
    const b = parseDecimal(original)
    return !!a && !!b && compareDecimal(a, b) === 0
  }
  return false
}
