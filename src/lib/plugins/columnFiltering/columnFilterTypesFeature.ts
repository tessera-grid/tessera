/**
 * Типы фильтров колонок (ADR 0045, §2–§3): поле `filter` в описании колонки и
 * функция фильтра по умолчанию, применяющая условия своего типа. Колонка без
 * `filter` в фильтрах колонок не участвует; свой `filterFn` колонки перекрывает этот.
 * Фича стоит после `columnFilteringFeature`: её `filterFn` по умолчанию сменяет `'auto'`.
 */
import type { FilterFn } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'
import {
  filterTypeOf,
  isInactiveFilter,
  matchesColumnFilter,
} from './conditions'
import type { ColumnFilterDef, ColumnFilterValue } from './types'

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
  }
  getValue: (columnId: string) => unknown
}

const columnTypeFilter = ((
  row: FilterRow,
  columnId: string,
  filter: ColumnFilterValue,
) => {
  const type = filterTypeOf(row.table.getColumn(columnId)?.columnDef.filter)
  if (!type) return true
  return matchesColumnFilter(type, row.getValue(columnId), filter)
}) as unknown as FilterFn<any, any>

columnTypeFilter.autoRemove = isInactiveFilter

export const columnFilterTypesFeature: TableFeature = {
  getDefaultColumnDef: () => ({ filterFn: columnTypeFilter }),
}
