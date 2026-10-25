import type { ColumnFiltersState, SortingState } from '../../types'

/** Запрос строк `[start, end)` под текущие сортировку, фильтры и поиск (ADR 0138, §1). */
export interface ServerRowsRequest {
  start: number
  end: number
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: string
  signal: AbortSignal
}

export interface ServerRowsResponse<TData = unknown> {
  rows: TData[]
  /** Итог, если сервер его знает. */
  rowCount?: number
}

export interface ServerRowModelHooks<TData = any> {
  /** Загрузить строки; читается живо. */
  getRows?: (
    request: ServerRowsRequest,
  ) => PromiseLike<ServerRowsResponse<TData>> | ServerRowsResponse<TData>
}
