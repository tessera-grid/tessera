import type { RowTransaction } from '../../core/rowTransactions'
import type { ColumnFiltersState, SortingState } from '../../types'

/** Request for rows `[start, end)` under the current sorting, filters and search (ADR 0138, §1). */
export interface ServerRowsRequest {
  start: number
  end: number
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: string
  signal: AbortSignal
  /** The row whose children are requested (lazy children, ADR 0138, §14); none for roots. */
  parentId?: string
  /** Grouping columns by level (ADR 0144); empty without grouping. */
  grouping: string[]
  /** Group values from the root to the requested level; empty at the root. */
  groupKeys: unknown[]
  /** Column → the name of its `aggregationFn` (`sum`, `count`, `mean`…); string names only. */
  aggregations: Record<string, string>
  /** Columns with `aggregationScope: 'all'`: the total and group aggregates span all tree nodes (ADR 0229). */
  aggregationScopes: Record<string, 'all'>
}

export interface ServerRowsResponse<TData = unknown> {
  rows: TData[]
  /** The total, if the server knows it. */
  rowCount?: number
  /** Column totals over the whole result set (ADR 0144, §4); read from the root response. */
  totals?: Record<string, unknown>
  /** Data rows in the whole result set with grouping: then the root holds groups. */
  leafCount?: number
}

/**
 * Транзакция строк серверной модели (ADR 0157): добавить, обновить и удалить строки без
 * перезапроса. `index` — место добавленных в ветке `parentId` (в списке уже без удалённых);
 * без него таблица тихо перезапрашивает окно.
 */
/** A row transaction — the same shape as on the client (ADR 0194, §4). */
export type ServerRowTransaction<TData = any> = RowTransaction<TData>

/** Transaction result: applied, the window was requested again, or the branch isn't in the layout. */
export type ServerRowTransactionResult =
  'applied' | 'refetch' | 'branchNotLoaded'

export interface ServerRowModelHooks<TData = any> {
  /** Loads rows; read live. */
  getRows?: (
    request: ServerRowsRequest,
  ) => PromiseLike<ServerRowsResponse<TData>> | ServerRowsResponse<TData>
  /** Rows in a group — from the group row of the response (ADR 0144, §2); read live. */
  getGroupChildCount?: (row: TData) => number | undefined
  /** Data rows in a group at all levels — for its label (ADR 0184); read live. */
  getGroupRowCount?: (row: TData) => number | undefined
}
