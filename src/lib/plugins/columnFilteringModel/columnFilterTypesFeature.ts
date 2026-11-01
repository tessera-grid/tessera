/**
 * Типы фильтров колонок (ADR 0045, §2–§3; ADR 0172, DT12): вид фильтра — от типа данных
 * колонки, функция фильтра по умолчанию применяет условия своего вида; свой `filterFn`
 * колонки перекрывает этот.
 * Фича стоит после `columnFilteringFeature`: её `filterFn` по умолчанию сменяет `'auto'`.
 */
import type { FilterFn } from '@tanstack/react-table'

import type { TableFeature } from '../../types'
import {
  columnFilterDefOf,
  dateCellWall,
  filterTypeOf,
  isDateType,
  isInactiveFilter,
  matchesColumnFilter,
} from './conditions'
import { matchesDate, nowWall } from './dates'
import { optionKeyOf } from './options'
import type { ColumnFilterDef, ColumnFilterValue, DateFilter } from './types'

declare module '@tanstack/react-table' {
  interface Plugins {
    columnFilterTypesFeature: TableFeature
  }
}

interface FilterRow {
  table: {
    getColumn: (
      id: string,
    ) => Parameters<typeof columnFilterDefOf>[0] | undefined
    options: { timeZone?: string }
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
  const column = row.table.getColumn(columnId)
  const def = column ? columnFilterDefOf(column) : undefined
  const type = filterTypeOf(def)
  // Значение не условие своего вида (`setFilterValue('b')`) — фильтром не считается.
  if (!type || isInactiveFilter(filter)) return true
  if (isDateType(type)) {
    // Пояс дат — опция таблицы (ADR 0169, §5).
    const timeZone = row.table.options.timeZone
    return matchesDate(
      cellWallOf(row, columnId, def, timeZone),
      filter as DateFilter,
      () => nowWall(timeZone),
    )
  }
  // Запись `object` сравнивается по ключу (ADR 0174, TY4).
  const value = optionKeyOf(row.table, column as never, row.getValue(columnId))
  return matchesColumnFilter(type, value, filter)
}) as unknown as FilterFn<any, any>

columnTypeFilter.autoRemove = isInactiveFilter

export const columnFilterTypesFeature: TableFeature = {
  getDefaultColumnDef: () => ({ filterFn: columnTypeFilter }),
}
