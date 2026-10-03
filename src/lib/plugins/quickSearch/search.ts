/**
 * Быстрый поиск (ADR 0045, §6): «содержит» без учёта регистра по видимым колонкам
 * со значением строка или число. Служебные колонки и колонки дат (ADR 0047, §6) не
 * участвуют; у колонок с вариантами ищется подпись (ADR 0048, §4).
 */
import type { FilterFn } from '@tanstack/react-table'

import { type ColumnOptionsDef, optionTextOf } from '../../core/columnOptions'

interface SearchRow {
  getValue: (columnId: string) => unknown
  table: {
    getColumn: (
      id: string,
    ) => { id: string; columnDef: ColumnOptionsDef } | undefined
  }
}

interface SearchColumn {
  columnDef?: { filter?: string | { type?: string } }
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

export const quickSearchFilter = ((
  row: SearchRow,
  columnId: string,
  query: string,
) => {
  const value = row.getValue(columnId)
  const column = row.table.getColumn(columnId)
  const text = column ? optionTextOf(row.table, column, value) : undefined
  return matchesSearch(text ?? value, query)
}) as unknown as FilterFn<any, any>

quickSearchFilter.resolveFilterValue = normalizeSearch

const isDateColumn = ({ columnDef }: SearchColumn) => {
  const def = columnDef?.filter
  const type = typeof def === 'object' ? def.type : def
  return type === 'date' || type === 'datetime'
}

export const canSearchColumn = (column: SearchColumn) =>
  (column.getIsVisible?.() ?? true) &&
  !column.getIsActionsColumn?.() &&
  !isDateColumn(column)
