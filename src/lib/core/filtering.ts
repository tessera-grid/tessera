/**
 * Действия пользователя с фильтрами (ADR 0045, §10): меняют срез и зовут бизнес-колбэк
 * плагина — `onFilterChange` / `onSearchChange`. Программная смена среза колбэк не
 * зовёт (как `onPageChange`, PG6). Общие для `columnFiltering`, `quickSearch` и
 * заглушки пустого результата. В серверном режиме — серверные действия (ADR 0116).
 */
import { reportAction, sourceOf } from './debugActions'
import { readPluginHooks } from './definePlugin'
import { searchColumnIdsOf } from './searchColumns'
import { ILLUSTRATION_SIZE, type StubEntry } from './stubs'
import {
  runServerAction,
  type ServerActionContext,
  type ServerActionResult,
} from './serverActions'

export interface ColumnFilterEntry {
  id: string
  value: unknown
}

/** Пользователь изменил фильтры колонок (после дебаунса). */
export type FilterChangeHook = (
  filters: ColumnFilterEntry[],
  context: ServerActionContext,
) => ServerActionResult

/** Пользователь изменил строку поиска (после дебаунса); `scope` — где ищет грид. */
export type SearchChangeHook = (
  search: string,
  scope: SearchScope,
  context: ServerActionContext,
) => ServerActionResult

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
  onFilterChange?: FilterChangeHook
}

interface SearchHooks {
  onSearchChange?: SearchChangeHook
}

/** Где ищет грид — для сервера, чтобы искать по тем же колонкам (ADR 0053). */
export interface SearchScope {
  columnIds: string[]
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

/** Колонки, чей фильтр отличается в двух наборах. */
const changedColumns = (
  before: ColumnFilterEntry[],
  after: ColumnFilterEntry[],
): string[] => {
  const valueOf = (filters: ColumnFilterEntry[], id: string) =>
    filters.find(filter => filter.id === id)?.value
  const ids = new Set([...before, ...after].map(filter => filter.id))
  return [...ids].filter(id => valueOf(before, id) !== valueOf(after, id))
}

/**
 * Источник действия фильтра: событие, которое его вызвало; дебаунс ввода срабатывает
 * уже после события — это клавиатура (ADR 0125).
 */
const filterSource = () =>
  globalThis.event ? sourceOf(globalThis.event) : 'keyboard'

/** Заменить фильтры колонок целиком. */
export const setColumnFiltersByUser = (
  table: unknown,
  filters: ColumnFilterEntry[],
) => {
  reportAction(table, {
    plugin: 'columnFiltering',
    action: filters.length === 0 ? 'clearFilters' : 'setFilters',
    detail: () => ({ filters }),
    source: filterSource(),
  })
  applyColumnFilters(table, filters)
}

const applyColumnFilters = (table: unknown, filters: ColumnFilterEntry[]) => {
  const t = table as FilteringTable
  const { onFilterChange } = readPluginHooks<FilteringHooks>(
    t,
    'columnFiltering',
  )
  runServerAction(
    table,
    'filtering',
    () => t.setColumnFilters?.(filters),
    context => onFilterChange?.(filters, context),
    {
      control: 'columnFiltering',
      columns: changedColumns(columnFiltersOf(table), filters),
    },
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
  reportAction(table, {
    plugin: 'columnFiltering',
    action: remove ? 'removeFilter' : 'setFilter',
    detail: () => ({ columnId, ...(remove ? {} : { value }) }),
    source: filterSource(),
  })
  applyColumnFilters(table, next)
}

/** Строка быстрого поиска; пустая снимает поиск. */
export const setSearchByUser = (table: unknown, search: string) => {
  reportAction(table, {
    plugin: 'quickSearch',
    action: search === '' ? 'clearSearch' : 'search',
    detail: search === '' ? undefined : { query: search },
    source: filterSource(),
  })
  applySearch(table, search)
}

const applySearch = (table: unknown, search: string) => {
  const t = table as FilteringTable
  const { onSearchChange } = readPluginHooks<SearchHooks>(t, 'quickSearch')
  runServerAction(
    table,
    'search',
    () => t.setGlobalFilter?.(search === '' ? undefined : search),
    context =>
      onSearchChange?.(search, { columnIds: searchColumnIdsOf(t) }, context),
    { control: 'quickSearch' },
  )
}

/** Снять фильтры колонок и поиск (заглушка пустого результата). */
export const resetFiltersByUser = (table: unknown) => {
  reportAction(table, {
    plugin: 'core',
    action: 'resetFilters',
    source: filterSource(),
  })
  if (columnFiltersOf(table).length > 0) applyColumnFilters(table, [])
  if (searchOf(table) !== '') applySearch(table, '')
}

/**
 * Заглушка пустого результата фильтра или поиска (ADR 0045, §9; ADR 0123): запись
 * реестра у моделей фильтрации и поиска, «Reset filters» сбрасывает и то и другое.
 */
export const FILTERED_STUB: StubEntry = {
  id: 'filtered',
  priority: 40,
  placement: 'body',
  when: ({ table, rowCount }) =>
    rowCount === 0 &&
    (columnFiltersOf(table).length > 0 || searchOf(table).trim() !== ''),
  title: labels => labels.noRowsMatchFilters,
  media: 'emptyState',
  mediaSize: ILLUSTRATION_SIZE,
  action: ({ table }, labels) => ({
    label: labels.resetFilters,
    run: () => resetFiltersByUser(table),
    testId: 'filter-stub-reset',
  }),
  testId: 'filter-stub',
}
