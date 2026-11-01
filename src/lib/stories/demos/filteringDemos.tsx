/**
 * «Сервер» фильтрации для гайдов (ADR 0045, ADR 0048): грид не фильтрует сам — фильтры и
 * поиск уходят в `onFilterChange` / `onSearchChange`, «сервер» отвечает отфильтрованным
 * набором теми же условиями, что у клиентского режима.
 */
import type { ColumnFilterValue } from '../../plugins'
import type { ColumnOptionsDef } from '../../core/columnOptions'
import type { BuiltInDataType } from '../../core/dataTypes'
import {
  filterTypeOfBase,
  matchesColumnFilter,
} from '../../plugins/columnFilteringModel/conditions'
import {
  matchesSearch,
  normalizeSearch,
} from '../../plugins/quickSearchModel/search'
import {
  type FilteringItem,
  filteringColumns,
  makeFilteringData,
  makeOptionFilteringData,
  type OptionFilteringItem,
  optionFilteringColumns,
} from '../__mocks__/filteringData'

export type ServerFilters = { id: string; value: unknown }[]

export const SERVER_TOTAL = 200
export const SERVER_DATA = makeFilteringData(SERVER_TOTAL)

/** Вид фильтра колонки «сервера» — по её типу данных, как у таблицы (ADR 0172, DT12). */
export const serverFilterTypeOf = (
  columns: readonly { id?: string }[],
  id: string,
) => {
  const def = columns.find(column => column.id === id) as
    (ColumnOptionsDef & { dataType?: string }) | undefined
  if (!def) return undefined
  return def.loadOptions
    ? 'lookup'
    : filterTypeOfBase(def.dataType as BuiltInDataType | undefined)
}

const matches = (
  columns: readonly { id?: string }[],
  row: object,
  filters: ServerFilters,
) =>
  filters.every(({ id, value }) => {
    const type = serverFilterTypeOf(columns, id)
    return (
      !type ||
      matchesColumnFilter(
        type,
        (row as Record<string, unknown>)[id],
        value as ColumnFilterValue,
      )
    )
  })

/** Ответ «сервера»: фильтры колонок и поиск по колонкам грида (ADR 0053). */
export const queryFiltering = (
  filters: ServerFilters,
  search: string,
  columnIds: string[],
): FilteringItem[] => {
  const needle = normalizeSearch(search)
  return SERVER_DATA.filter(
    row =>
      matches(filteringColumns, row, filters) &&
      (needle === '' ||
        columnIds.some(id =>
          matchesSearch(row[id as keyof FilteringItem], needle),
        )),
  )
}

export const OPTION_TOTAL = 200
export const OPTION_SERVER_DATA = makeOptionFilteringData(OPTION_TOTAL)

/** Ответ «сервера» фильтра вариантов. */
export const queryOptions = (filters: ServerFilters): OptionFilteringItem[] =>
  OPTION_SERVER_DATA.filter(row =>
    matches(optionFilteringColumns, row, filters),
  )
