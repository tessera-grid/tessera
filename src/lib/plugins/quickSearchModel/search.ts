/**
 * Быстрый поиск (ADR 0045, §6): «содержит» без учёта регистра по видимым колонкам — по
 * показанному тексту (ADR 0172, DT15): формат типа, подписи вариантов (ADR 0048, §4), даты в
 * виде `2026-10-31`. Служебные колонки и булевы (значок, а не текст) не участвуют; колонка
 * без типа ищется по строке, числу или дате. Текст кешируется на строку и колонку.
 */
import type { FilterFn } from '@tanstack/react-table'

import type { ColumnOptionsDef } from '../../core/columnOptions'
import {
  type FormatColumn,
  formatDataTypeValue,
} from '../../core/dataTypeFormat'
import type { DataTypeRegistry, ResolvedDataType } from '../../core/dataTypes'

interface SearchTable {
  options: { dataTypes?: DataTypeRegistry; locale?: string; timeZone?: string }
  getColumn: (id: string) =>
    | (FormatColumn & {
        getDataType?: () => ResolvedDataType | undefined
      })
    | undefined
}

interface SearchRow {
  original: unknown
  getValue: (columnId: string) => unknown
  table: SearchTable
}

interface SearchColumn {
  getDataType?: () => ResolvedDataType | undefined
  getIsVisible?: () => boolean
  getIsActionsColumn?: () => boolean
}

/** Задержка применения ввода в поле поиска по умолчанию (ADR 0045, §6). */
export const DEFAULT_SEARCH_DEBOUNCE_MS = 200

export const normalizeSearch = (search: unknown) =>
  typeof search === 'string' ? search.trim().toLowerCase() : ''

export const matchesSearch = (value: unknown, query: string) =>
  query === '' ||
  ((typeof value === 'string' || typeof value === 'number') &&
    String(value).toLowerCase().includes(query))

interface RowTexts {
  original: unknown
  locale: string | undefined
  timeZone: string | undefined
  dataTypes: DataTypeRegistry | undefined
  /** Текст колонки в нижнем регистре и описание колонки, по которому он посчитан. */
  byColumn: Map<string, { columnDef: object; text: string | undefined }>
}

const textsByRow = new WeakMap<object, RowTexts>()

/** Тексты строки; смена данных строки, языка, пояса или реестра типов их сбрасывает. */
const textsOf = (row: SearchRow): RowTexts['byColumn'] => {
  const { locale, timeZone, dataTypes } = row.table.options
  const cached = textsByRow.get(row)
  if (
    cached &&
    cached.original === row.original &&
    cached.locale === locale &&
    cached.timeZone === timeZone &&
    cached.dataTypes === dataTypes
  ) {
    return cached.byColumn
  }
  const byColumn: RowTexts['byColumn'] = new Map()
  textsByRow.set(row, {
    original: row.original,
    locale,
    timeZone,
    dataTypes,
    byColumn,
  })
  return byColumn
}

/** Показанный текст значения; `undefined` — колонка без типа и значение не текст. */
const shownText = (
  row: SearchRow,
  column: NonNullable<ReturnType<SearchTable['getColumn']>>,
) => {
  const value = row.getValue(column.id)
  const typed = !!column.getDataType?.()
  const hasOptions = !!(column.columnDef as ColumnOptionsDef).options
  if (
    !typed &&
    !hasOptions &&
    !(column.columnDef as ColumnOptionsDef).getOptionLabel &&
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    !(value instanceof Date)
  ) {
    return undefined
  }
  return formatDataTypeValue(
    row.table,
    column,
    value,
    row.original,
  ).toLowerCase()
}

export const quickSearchFilter = ((
  row: SearchRow,
  columnId: string,
  query: string,
) => {
  if (query === '') return true
  const column = row.table.getColumn(columnId)
  if (!column) return false
  const texts = textsOf(row)
  let entry = texts.get(columnId)
  if (!entry || entry.columnDef !== column.columnDef) {
    entry = { columnDef: column.columnDef, text: shownText(row, column) }
    texts.set(columnId, entry)
  }
  return entry.text !== undefined && entry.text.includes(query)
}) as unknown as FilterFn<any, any>

quickSearchFilter.resolveFilterValue = normalizeSearch

/** Булево показано значком, а не текстом — поиск его обходит (ADR 0053, ADR 0172). */
const isUnsearchableType = (column: SearchColumn) =>
  column.getDataType?.()?.base === 'boolean'

export const canSearchColumn = (column: SearchColumn) =>
  (column.getIsVisible?.() ?? true) &&
  !column.getIsActionsColumn?.() &&
  !isUnsearchableType(column)
