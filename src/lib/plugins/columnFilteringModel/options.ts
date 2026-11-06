/**
 * Фильтр вариантов (ADR 0048, §2–§3): условия `select` / `multiselect` / `lookup`,
 * варианты из данных и фасетные счётчики — по строкам, прошедшим остальные фильтры и
 * поиск (стоковая фасетная модель строк TanStack без фильтра этой колонки). У записи
 * `object` варианты, счётчики и условия — по ключу, подписи — из записей (ADR 0174, TY4).
 */
import {
  type ColumnOption,
  type ColumnOptionsDef,
  isEmptyOptionValue,
  optionLabelOf,
  type OptionValue,
} from '../../core/columnOptions'
import { dataModeOf } from '../../core/dataMode'
import { logWarn } from '../../util/logger'
import { objectKeyOf, objectLabelOf } from '../../core/dataTypeFormat'
import type { ResolvedDataType } from '../../core/dataTypes'
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
  getDataType?: () => ResolvedDataType | undefined
}

const isObjectColumn = (column: FacetColumn) =>
  column.getDataType?.()?.base === 'object'

/** Значение для вариантов и условий: у записи `object` — её ключ, у прочих — как есть. */
export const optionKeyOf = (
  table: unknown,
  column: FacetColumn,
  value: unknown,
): unknown =>
  isObjectColumn(column)
    ? objectKeyOf(table as never, column as never, value)
    : value

interface FacetTable {
  getPreFilteredRowModel: () => { flatRows: FacetRow[] }
}

/** Варианты и их счётчики — от сервера: фильтры колонок выполняет он (ADR 0169). */
const filtersOnServer = (table: unknown) =>
  dataModeOf(table, 'filtering') === 'server'

const countCache = new WeakMap<FacetRow[], Map<string, Map<unknown, number>>>()

const countValues = (table: unknown, rows: FacetRow[], column: FacetColumn) => {
  let byColumn = countCache.get(rows)
  if (!byColumn) countCache.set(rows, (byColumn = new Map()))
  let counts = byColumn.get(column.id)
  if (counts) return counts
  counts = new Map()
  for (const row of rows) {
    const key = optionKeyOf(table, column, row.getValue(column.id))
    for (const value of valuesOf(key)) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  byColumn.set(column.id, counts)
  return counts
}

const labelCache = new WeakMap<FacetRow[], Map<string, Map<unknown, string>>>()

/** Подписи записей `object` по ключу — из всех строк колонки (TY4, TY7). */
const objectLabels = (table: unknown, column: FacetColumn) => {
  const rows = (table as FacetTable).getPreFilteredRowModel().flatRows
  let byColumn = labelCache.get(rows)
  if (!byColumn) labelCache.set(rows, (byColumn = new Map()))
  let labels = byColumn.get(column.id)
  if (labels) return labels
  labels = new Map()
  const definition = column.getDataType!()!.definition
  for (const row of rows) {
    const value = row.getValue(column.id)
    const key = optionKeyOf(table, column, value)
    if (!isEmptyOptionValue(key) && !labels.has(key)) {
      labels.set(key, objectLabelOf(definition, value))
    }
  }
  byColumn.set(column.id, labels)
  return labels
}

/** Подпись варианта фильтра: у записи — из данных, иначе — подпись варианта колонки. */
export const filterOptionLabelOf = (
  table: unknown,
  column: FacetColumn,
  value: unknown,
): string =>
  (isObjectColumn(column) && !filtersOnServer(table)
    ? objectLabels(table, column).get(value)
    : undefined) ?? optionLabelOf(table as object, column, value)

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
  return rows ? countValues(table, rows, column) : undefined
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
  if (filtersOnServer(table)) {
    logWarn(
      table as never,
      `columnFiltering: column "${column.id}" filters on the server without options: pass options or loadOptions`,
      `columnFiltering:noOptions:${column.id}`,
    )
    return []
  }
  const values = countValues(table, t.getPreFilteredRowModel().flatRows, column)
  return [...values.keys()]
    .map(value => ({
      value: value as OptionValue,
      label: filterOptionLabelOf(table, column, value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
