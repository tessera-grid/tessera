import type { ColumnFiltersState, SortingState } from '../../types'

/** Запрос строк `[start, end)` под текущие сортировку, фильтры и поиск (ADR 0138, §1). */
export interface ServerRowsRequest {
  start: number
  end: number
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: string
  signal: AbortSignal
  /** Строка, чьих детей просят (ленивые дети, ADR 0138, §14); у корней — нет. */
  parentId?: string
  /** Колонки группировки по уровням (ADR 0144); без группировки — пусто. */
  grouping: string[]
  /** Значения групп от корня до уровня запроса; у корня — пусто. */
  groupKeys: unknown[]
  /** Колонка → имя её `aggregationFn` (`sum`, `count`, `mean`…); только строковые. */
  aggregations: Record<string, string>
}

export interface ServerRowsResponse<TData = unknown> {
  rows: TData[]
  /** Итог, если сервер его знает. */
  rowCount?: number
  /** Итоги колонок по всей выборке (ADR 0144, §4); читаются из ответа корня. */
  totals?: Record<string, unknown>
  /** Строк данных во всей выборке при группировке: корень тогда — группы. */
  leafCount?: number
}

/**
 * Транзакция строк серверной модели (ADR 0157): добавить, обновить и удалить строки без
 * перезапроса. `index` — место добавленных в ветке `parentId` (в списке уже без удалённых);
 * без него таблица тихо перезапрашивает окно.
 */
export interface ServerRowTransaction<TData = any> {
  add?: TData[]
  index?: number
  update?: TData[]
  remove?: string[]
  parentId?: string
  /** Итог ветки после транзакции, если его знает приложение. */
  rowCount?: number
}

/** Итог транзакции: применена, окно перезапрошено или ветки нет в раскладке. */
export type ServerRowTransactionResult =
  'applied' | 'refetch' | 'branchNotLoaded'

export interface ServerRowModelHooks<TData = any> {
  /** Загрузить строки; читается живо. */
  getRows?: (
    request: ServerRowsRequest,
  ) => PromiseLike<ServerRowsResponse<TData>> | ServerRowsResponse<TData>
  /** Строк в группе — из строки-группы ответа (ADR 0144, §2); читается живо. */
  getGroupChildCount?: (row: TData) => number | undefined
  /** Строк данных в группе на всех уровнях — для подписи (ADR 0184); читается живо. */
  getGroupRowCount?: (row: TData) => number | undefined
}
