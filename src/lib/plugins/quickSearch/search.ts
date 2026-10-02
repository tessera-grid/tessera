/**
 * Быстрый поиск (ADR 0045, §6): «содержит» без учёта регистра по видимым колонкам
 * со значением строка или число. Служебные колонки не участвуют.
 */
import type { FilterFn } from '@tanstack/react-table'

interface SearchRow {
  getValue: (columnId: string) => unknown
}

interface SearchColumn {
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
) => matchesSearch(row.getValue(columnId), query)) as unknown as FilterFn<
  any,
  any
>

quickSearchFilter.resolveFilterValue = normalizeSearch

export const canSearchColumn = (column: SearchColumn) =>
  (column.getIsVisible?.() ?? true) && !column.getIsActionsColumn?.()
