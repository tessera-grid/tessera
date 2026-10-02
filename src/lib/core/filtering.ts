/**
 * Действия пользователя с фильтрами (ADR 0045, §10): меняют срез и зовут бизнес-колбэк
 * плагина — `onFilterChange` / `onSearchChange`. Программная смена среза колбэк не
 * зовёт (как `onPageChange`, PG6). Общие для `columnFiltering`, `quickSearch` и
 * заглушки пустого результата.
 */
import { readPluginHooks } from './definePlugin'

export interface ColumnFilterEntry {
  id: string
  value: unknown
}

interface FilteringTable {
  atoms: {
    columnFilters?: { get: () => ColumnFilterEntry[] | undefined }
    globalFilter?: { get: () => unknown }
  }
  getHooks: () => unknown
  getColumn?: (id: string) =>
    | {
        getFilterFn?: () =>
          { autoRemove?: (value: unknown) => boolean } | undefined
      }
    | undefined
  setColumnFilters?: (filters: ColumnFilterEntry[]) => void
  setGlobalFilter?: (value: string | undefined) => void
}

interface FilteringHooks {
  onFilterChange?: (filters: ColumnFilterEntry[]) => void
}

interface SearchHooks {
  onSearchChange?: (search: string) => void
}

const EMPTY: ColumnFilterEntry[] = []

export const columnFiltersOf = (table: unknown): ColumnFilterEntry[] =>
  (table as FilteringTable).atoms.columnFilters?.get() ?? EMPTY

export const searchOf = (table: unknown): string => {
  const value = (table as FilteringTable).atoms.globalFilter?.get()
  return typeof value === 'string' ? value : ''
}

/** Активен ли фильтр колонки или поиск. */
export const isFilteringActive = (state: {
  columnFilters?: unknown
  globalFilter?: unknown
}): boolean =>
  ((state.columnFilters as unknown[] | undefined)?.length ?? 0) > 0 ||
  (typeof state.globalFilter === 'string' && state.globalFilter.trim() !== '')

/** Заменить фильтры колонок целиком. */
export const setColumnFiltersByUser = (
  table: unknown,
  filters: ColumnFilterEntry[],
) => {
  const t = table as FilteringTable
  t.setColumnFilters?.(filters)
  readPluginHooks<FilteringHooks>(t, 'columnFiltering').onFilterChange?.(
    filters,
  )
}

/** Фильтр одной колонки; `undefined` или неприменимое значение снимает его. */
export const setColumnFilterByUser = (
  table: unknown,
  columnId: string,
  value: unknown,
) => {
  const t = table as FilteringTable
  const autoRemove = t.getColumn?.(columnId)?.getFilterFn?.()?.autoRemove
  const remove = value === undefined || !!autoRemove?.(value)
  const current = columnFiltersOf(table)
  const index = current.findIndex(filter => filter.id === columnId)
  const next = remove
    ? current.filter(filter => filter.id !== columnId)
    : index === -1
      ? [...current, { id: columnId, value }]
      : current.map(filter =>
          filter.id === columnId ? { id: columnId, value } : filter,
        )
  if (remove && index === -1) return
  setColumnFiltersByUser(table, next)
}

/** Строка быстрого поиска; пустая снимает поиск. */
export const setSearchByUser = (table: unknown, search: string) => {
  const t = table as FilteringTable
  t.setGlobalFilter?.(search === '' ? undefined : search)
  readPluginHooks<SearchHooks>(t, 'quickSearch').onSearchChange?.(search)
}

/** Снять фильтры колонок и поиск (заглушка пустого результата). */
export const resetFiltersByUser = (table: unknown) => {
  if (columnFiltersOf(table).length > 0) setColumnFiltersByUser(table, [])
  if (searchOf(table) !== '') setSearchByUser(table, '')
}
