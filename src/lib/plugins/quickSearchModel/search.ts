/**
 * Быстрый поиск (ADR 0045, §6): «содержит» без учёта регистра по видимым колонкам — по
 * показанному тексту (ADR 0172, DT15): формат типа, подписи вариантов (ADR 0048, §4), даты в
 * виде `2026-10-31`. Служебные колонки и булевы (значок, а не текст) не участвуют; колонка
 * без типа ищется по строке, числу или дате. Стадия фильтра проверяет строку склеенным
 * текстом по колонкам поиска, посчитанным раз на строку (ADR 0201).
 */
import type { FilterFn } from '@tanstack/react-table'

import type { ColumnOptionsDef } from '../../core/columnOptions'
import {
  type FormatColumn,
  columnFormatter,
  formatDataTypeValue,
} from '../../core/dataTypeFormat'
import type { DataTypeRegistry, ResolvedDataType } from '../../core/dataTypes'

interface SearchTable {
  options: { dataTypes?: DataTypeRegistry; locale?: string; timeZone?: string }
  getColumn: (id: string) => SearchFormatColumn | undefined
}

type SearchFormatColumn = FormatColumn & {
  getDataType?: () => ResolvedDataType | undefined
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

/** Колонка с типом или вариантами ищется по любому значению, без них — по тексту. */
const isTyped = (column: SearchFormatColumn) => {
  const def = column.columnDef as ColumnOptionsDef
  return !!column.getDataType?.() || !!def.options || !!def.getOptionLabel
}

/** Ищется ли значение: колонка без типа ищет только строку, число или дату. */
const isShown = (value: unknown, typed: boolean) =>
  typed ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  value instanceof Date

/** Проверка одной колонки: путь стоковой модели и запроса с разделителем (QT5). */
const searchColumn = (row: SearchRow, columnId: string, query: string) => {
  if (query === '') return true
  const column = row.table.getColumn(columnId)
  if (!column) return false
  const value = row.getValue(columnId)
  return (
    isShown(value, isTyped(column)) &&
    formatDataTypeValue(row.table, column, value, row.original)
      .toLowerCase()
      .includes(query)
  )
}

/** Разделитель частей текста строки: запрос не совпадает на стыке колонок (QT2). */
const SEPARATOR = '\u0000'

/** Подпись прохода: колонки поиска, язык, пояс и реестр типов (ADR 0201, §3). */
interface Pass {
  columns: readonly { id: string; columnDef: object }[]
  locale: string | undefined
  timeZone: string | undefined
  dataTypes: DataTypeRegistry | undefined
}

const lastPass = new WeakMap<object, Pass>()

/** Та же подпись подряд — тот же объект: сверка кэша строки — сравнение ссылок. */
const passOf = (
  table: SearchTable,
  columns: readonly SearchFormatColumn[],
): Pass => {
  const { locale, timeZone, dataTypes } = table.options
  const last = lastPass.get(table)
  if (
    last &&
    last.locale === locale &&
    last.timeZone === timeZone &&
    last.dataTypes === dataTypes &&
    last.columns.length === columns.length &&
    last.columns.every(
      (column, i) =>
        column.id === columns[i]!.id &&
        column.columnDef === columns[i]!.columnDef,
    )
  ) {
    return last
  }
  const pass: Pass = {
    columns: columns.map(({ id, columnDef }) => ({ id, columnDef })),
    locale,
    timeZone,
    dataTypes,
  }
  lastPass.set(table, pass)
  return pass
}

const textByRow = new WeakMap<
  object,
  { pass: Pass; original: unknown; text: string }
>()

/** Проверка строки склеенным текстом, подготовленная раз на проход (ADR 0201, §2). */
const prepareRowCheck = (
  table: SearchTable,
  columns: readonly SearchFormatColumn[],
  query: unknown,
): ((row: SearchRow) => boolean) | undefined => {
  if (typeof query !== 'string' || query.includes(SEPARATOR)) return undefined
  if (query === '') return () => true
  const pass = passOf(table, columns)
  const parts = columns.map(column => ({
    id: column.id,
    typed: isTyped(column),
    format: columnFormatter(table, column),
  }))
  const textOf = (row: SearchRow) => {
    const cached = textByRow.get(row)
    if (cached && cached.pass === pass && cached.original === row.original) {
      return cached.text
    }
    let text = ''
    for (let i = 0; i < parts.length; i++) {
      const { id, typed, format } = parts[i]!
      if (i) text += SEPARATOR
      const value = row.getValue(id)
      if (isShown(value, typed))
        text += format(value, row.original).toLowerCase()
    }
    textByRow.set(row, { pass, original: row.original, text })
    return text
  }
  return row => textOf(row).includes(query)
}

export const quickSearchFilter = Object.assign(searchColumn, {
  resolveFilterValue: normalizeSearch,
  prepareRowCheck,
}) as unknown as FilterFn<any, any>

/** Булево показано значком, а не текстом — поиск его обходит (ADR 0053, ADR 0172). */
const isUnsearchableType = (column: SearchColumn) =>
  column.getDataType?.()?.base === 'boolean'

export const canSearchColumn = (column: SearchColumn) =>
  (column.getIsVisible?.() ?? true) &&
  !column.getIsActionsColumn?.() &&
  !isUnsearchableType(column)
