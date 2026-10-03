/**
 * Типы фильтров колонок (ADR 0045, §2–§3): поле `filter` в описании колонки и
 * функция фильтра по умолчанию, применяющая условия своего типа. Колонка без
 * `filter` в фильтрах колонок не участвует; свой `filterFn` колонки перекрывает этот.
 * Фича стоит после `columnFilteringFeature`: её `filterFn` по умолчанию сменяет `'auto'`.
 */
import type { FilterFn } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'
import {
  dateCellWall,
  filterTypeOf,
  isDateType,
  isInactiveFilter,
  matchesColumnFilter,
} from './conditions'
import { matchesDate, nowWall } from './dates'
import type { ColumnFilterDef, ColumnFilterValue, DateFilter } from './types'

interface ColumnFilterTypesColumnDef {
  /** Тип фильтра колонки; без него колонку не отфильтровать (ADR 0045). */
  filter?: ColumnFilterDef
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    columnFilterTypesFeature: TableFeature
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    columnFilterTypesFeature: ColumnFilterTypesColumnDef
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

interface FilterRow {
  table: {
    getColumn: (
      id: string,
    ) => { columnDef: ColumnFilterTypesColumnDef } | undefined
    options: { columnFilteringTimeZone?: string }
  }
  getValue: (columnId: string) => unknown
}

interface CachedDate {
  value: unknown
  timeZone: string | undefined
  wall: number | null
}

/** Разобранные даты по строке и колонке: фильтр не разбирает их на каждое применение. */
const dateCache = new WeakMap<object, Map<string, CachedDate>>()

const cellWallOf = (
  row: FilterRow,
  columnId: string,
  def: ColumnFilterDef | undefined,
  timeZone: string | undefined,
) => {
  const value = row.getValue(columnId)
  let byColumn = dateCache.get(row)
  if (!byColumn) dateCache.set(row, (byColumn = new Map()))
  const cached = byColumn.get(columnId)
  if (cached && cached.value === value && cached.timeZone === timeZone) {
    return cached.wall
  }
  const wall = dateCellWall(def, value, timeZone)
  byColumn.set(columnId, { value, timeZone, wall })
  return wall
}

const columnTypeFilter = ((
  row: FilterRow,
  columnId: string,
  filter: ColumnFilterValue,
) => {
  const def = row.table.getColumn(columnId)?.columnDef.filter
  const type = filterTypeOf(def)
  if (!type) return true
  if (isDateType(type)) {
    const timeZone = row.table.options.columnFilteringTimeZone
    return matchesDate(
      cellWallOf(row, columnId, def, timeZone),
      filter as DateFilter,
      () => nowWall(timeZone),
    )
  }
  return matchesColumnFilter(type, row.getValue(columnId), filter)
}) as unknown as FilterFn<any, any>

columnTypeFilter.autoRemove = isInactiveFilter

export const columnFilterTypesFeature: TableFeature = {
  getDefaultColumnDef: () => ({ filterFn: columnTypeFilter }),
}
