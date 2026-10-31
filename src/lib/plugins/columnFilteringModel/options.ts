/**
 * Фильтр вариантов (ADR 0048, §2–§3): условия `select` / `multiselect` / `lookup`,
 * варианты из данных и фасетные счётчики — по строкам, прошедшим остальные фильтры и
 * поиск (стоковая фасетная модель строк TanStack без фильтра этой колонки).
 */
import {
  type ColumnOption,
  type ColumnOptionsDef,
  isEmptyOptionValue,
  optionLabelOf,
  type OptionValue,
} from '../../core/columnOptions'
import { dataModeOf } from '../../core/dataMode'
import type { ColumnFilterType, OptionFilter } from './types'

export const isOptionType = (type: ColumnFilterType | undefined) =>
  type === 'select' || type === 'multiselect' || type === 'lookup'

/** Значения ячейки: у массива — его элементы, пустое — ни одного. */
const valuesOf = (value: unknown): unknown[] =>
  isEmptyOptionValue(value) ? [] : Array.isArray(value) ? value : [value]

export const matchesOption = (
  value: unknown,
  filter: OptionFilter,
): boolean => {
  if (filter.operator === 'empty') return isEmptyOptionValue(value)
  if (filter.operator === 'notEmpty') return !isEmptyOptionValue(value)
  const selected = filter.value
  if (!Array.isArray(selected) || selected.length === 0) return true
  const values = valuesOf(value)
  switch (filter.operator) {
    case 'anyOf':
      return values.some(item => selected.includes(item as OptionValue))
    case 'noneOf':
      return !values.some(item => selected.includes(item as OptionValue))
    case 'allOf':
      return selected.every(item => values.includes(item))
  }
}

interface FacetRow {
  getValue: (columnId: string) => unknown
}

interface FacetColumn {
  id: string
  columnDef: ColumnOptionsDef
  getFacetedRowModel?: () => { flatRows: FacetRow[] }
}

interface FacetTable {
  getPreFilteredRowModel: () => { flatRows: FacetRow[] }
}

/** Варианты и их счётчики — от сервера: фильтры колонок выполняет он (ADR 0169). */
const filtersOnServer = (table: unknown) =>
  dataModeOf(table, 'filtering') === 'server'

const countCache = new WeakMap<FacetRow[], Map<string, Map<unknown, number>>>()

const countValues = (rows: FacetRow[], columnId: string) => {
  let byColumn = countCache.get(rows)
  if (!byColumn) countCache.set(rows, (byColumn = new Map()))
  let counts = byColumn.get(columnId)
  if (counts) return counts
  counts = new Map()
  for (const row of rows) {
    for (const value of valuesOf(row.getValue(columnId))) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  byColumn.set(columnId, counts)
  return counts
}

/**
 * Счётчики вариантов: строки, прошедшие остальные фильтры и поиск; строка
 * `multiselect` считается в каждом своём значении. Сервер — только `option.count`.
 */
export const optionCountsOf = (
  table: unknown,
  column: FacetColumn,
): Map<unknown, number> | undefined => {
  if (filtersOnServer(table)) {
    const options = column.columnDef.options ?? []
    if (!options.some(option => option.count !== undefined)) return undefined
    return new Map(
      options.flatMap(option =>
        option.count === undefined ? [] : [[option.value, option.count]],
      ),
    )
  }
  const rows = column.getFacetedRowModel?.().flatRows
  return rows ? countValues(rows, column.id) : undefined
}

/**
 * Варианты фильтра: `options` колонки; без них — уникальные непустые значения
 * колонки по всем строкам, по подписи. В серверном режиме из данных не собираются.
 */
export const filterOptionsOf = (
  table: unknown,
  column: FacetColumn,
): ColumnOption[] => {
  if (column.columnDef.options) return column.columnDef.options
  const t = table as FacetTable
  if (filtersOnServer(table)) return []
  const values = countValues(t.getPreFilteredRowModel().flatRows, column.id)
  return [...values.keys()]
    .map(value => ({
      value: value as OptionValue,
      label: optionLabelOf(table as object, column, value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
