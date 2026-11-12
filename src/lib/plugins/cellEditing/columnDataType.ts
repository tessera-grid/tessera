import { parseLocaleDecimal, parseLocaleNumber } from '../../util/parseNumber'
import type { ColumnOption } from '../../core/columnOptions'
import type { BuiltInDataType } from '../../core/dataTypes'
import { WALL_TIME, wallMsOf, wallMsToInstant } from '../../shared/wallTime'

/**
 * Тип данных колонки (ADR 0139): разбор текста редактора в значение того же вида, что
 * лежит в данных.
 */

/**
 * Вид разбора: `'date'` и `'dateTime'` — объект `Date`, `'dateString'` — строка
 * `YYYY-MM-DD`, `'dateTimeString'` — ISO со временем, `'select'` — значение варианта по
 * подписи, `'multiSelect'` — значения вариантов по подписям через запятую, `'object'` —
 * запись: её находит `parseEditText` по подписи или пишет свой `parseValue` (ADR 0174, TY8).
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
  | 'multiSelect'
  | 'object'
  | 'numberString'

/** Язык, пояс, подписи и варианты колонки — для разбора по типу (DT14, ADR 0219, WR5). */
export interface ParseContext {
  locale?: string
  timeZone?: string
  options?: readonly ColumnOption[]
  /** Подписи «да» и «нет» словаря таблицы. */
  booleanLabels?: { yes: string; no: string }
  /** Прежнее значение: строка без смещения у `dateTimeString` остаётся стенным временем. */
  current?: unknown
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

/** Разбор правки по базовому типу (ADR 0172, DT14). */
export const parseKindOf = (base: BuiltInDataType): ColumnDataType => base

const pad = (value: number) => String(value).padStart(2, '0')

interface DateFields {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
}

/** Порядок дня, месяца и года в числовой дате языка: `ru` — день, месяц, год. */
const dateOrders = new Map<string, readonly ('day' | 'month' | 'year')[]>()

const dateOrderOf = (locale: string) => {
  let order = dateOrders.get(locale)
  if (!order) {
    let parts: Intl.DateTimeFormatPart[] = []
    try {
      parts = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date(2001, 10, 22))
    } catch {
      // Неизвестный язык — порядок ISO.
    }
    const found = parts
      .map(part => part.type)
      .filter(
        (type): type is 'day' | 'month' | 'year' =>
          type === 'day' || type === 'month' || type === 'year',
      )
    order = found.length === 3 ? found : ['year', 'month', 'day']
    dateOrders.set(locale, order)
  }
  return order
}

const ISO_FIELDS =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
const LOCALE_FIELDS =
  /^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?:[,\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

/** Поля даты: ISO без смещения, вид таблицы или числовой порядок языка. */
const dateFieldsOf = (text: string, locale: string): DateFields | undefined => {
  const time = (match: RegExpExecArray, from: number) =>
    match[from] === undefined
      ? {}
      : {
          hour: Number(match[from]),
          minute: Number(match[from + 1]),
          second: Number(match[from + 2] ?? 0),
        }
  const iso = ISO_FIELDS.exec(text)
  if (iso)
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      ...time(iso, 4),
    }
  const local = LOCALE_FIELDS.exec(text)
  if (!local) return undefined
  const fields: Record<string, number> = {}
  dateOrderOf(locale).forEach((name, i) => {
    fields[name] = Number(local[i + 1])
  })
  const year = fields.year!
  return {
    year: year < 100 ? 2000 + year : year,
    month: fields.month!,
    day: fields.day!,
    ...time(local, 4),
  }
}

/** Проверенные поля как стенные миллисекунды; несуществующая дата — `null`. */
const wallOfFields = (fields: DateFields, withTime: boolean) =>
  wallMsOf(
    fields.year,
    fields.month,
    fields.day,
    withTime ? (fields.hour ?? 0) : 0,
    withTime ? (fields.minute ?? 0) : 0,
    withTime ? (fields.second ?? 0) : 0,
  )

/** Дата из полей в типе колонки: у дат без времени — полночь в поясе таблицы. */
const dateFromFields = (
  fields: DateFields,
  type: 'date' | 'dateTime' | 'dateString' | 'dateTimeString',
  { timeZone, current }: ParseContext,
): { value: unknown } | undefined => {
  const withTime = type === 'dateTime' || type === 'dateTimeString'
  const wall = wallOfFields(fields, withTime)
  if (wall === null) return undefined
  const day = `${fields.year}-${pad(fields.month)}-${pad(fields.day)}`
  if (type === 'dateString') return { value: day }
  if (
    type === 'dateTimeString' &&
    (current === null ||
      current === undefined ||
      (typeof current === 'string' && WALL_TIME.test(current.trim())))
  ) {
    return {
      value: `${day}T${pad(fields.hour ?? 0)}:${pad(fields.minute ?? 0)}`,
    }
  }
  const instant = new Date(wallMsToInstant(wall, timeZone))
  return { value: type === 'dateTimeString' ? instant.toISOString() : instant }
}

const parseDate = (
  trimmed: string,
  type: 'date' | 'dateTime' | 'dateString' | 'dateTimeString',
  context: ParseContext,
): { value: unknown } | undefined => {
  const fields = dateFieldsOf(trimmed, context.locale ?? 'en-US')
  if (fields) return dateFromFields(fields, type, context)
  // Прочее, что понимает `Date`: ISO со смещением, «Nov 12, 2026».
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return undefined
  switch (type) {
    case 'dateString':
      return { value: date.toISOString().slice(0, 10) }
    case 'dateTimeString':
      return { value: date.toISOString() }
    default:
      return { value: date }
  }
}

const TRUE_TEXTS = ['true', '1']
const FALSE_TEXTS = ['false', '0']

const parseBoolean = (
  lower: string,
  { booleanLabels }: ParseContext,
): { value: unknown } | undefined => {
  if (TRUE_TEXTS.includes(lower) || lower === booleanLabels?.yes.toLowerCase())
    return { value: true }
  if (FALSE_TEXTS.includes(lower) || lower === booleanLabels?.no.toLowerCase())
    return { value: false }
  return undefined
}

/** Вариант по подписи без учёта регистра, иначе по значению строкой. */
export const optionByText = (
  options: readonly ColumnOption[] | undefined,
  text: string,
): ColumnOption | undefined => {
  const lower = text.toLowerCase()
  return (
    options?.find(item => item.label.toLowerCase() === lower) ??
    options?.find(item => String(item.value) === text)
  )
}

/** Разделитель вариантов в ячейке `multiSelect`. */
const LIST_SEPARATOR = ','

/** Разобрать текст редактора; `undefined` — текст не разбирается в этот тип. */
export const parseByDataType = (
  text: string,
  type: ColumnDataType,
  context: ParseContext = {},
): { value: unknown } | undefined => {
  if (type === 'text') return { value: text }
  if (type === 'object') return undefined
  const trimmed = text.trim()
  if (trimmed === '') return { value: null }
  switch (type) {
    case 'number': {
      const value = parseLocaleNumber(trimmed, context.locale)
      return value !== null && Number.isFinite(value) ? { value } : undefined
    }
    case 'numberString': {
      // Десятичная строка, как набрана, без перевода во float (ADR 0174, TY12).
      const value = parseLocaleDecimal(trimmed, context.locale)
      return typeof value === 'string' ? { value } : undefined
    }
    case 'select': {
      const option = optionByText(context.options, trimmed)
      return option ? { value: option.value } : undefined
    }
    case 'multiSelect': {
      const values: unknown[] = []
      for (const part of trimmed.split(LIST_SEPARATOR)) {
        const item = part.trim()
        if (!item) continue
        const option = optionByText(context.options, item)
        if (!option) return context.options ? undefined : { value: text }
        values.push(option.value)
      }
      return { value: values }
    }
    case 'boolean':
      return parseBoolean(trimmed.toLowerCase(), context)
    case 'date':
    case 'dateTime':
    case 'dateString':
    case 'dateTimeString':
      return parseDate(trimmed, type, context)
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
