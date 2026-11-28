export interface InfiniteScrollLoadContext {
  /** Aborted when the load is stale: sorting, filters or search changed. */
  signal: AbortSignal
  /** Root rows in `data` at the time of the request — the offset of the next block. */
  loaded: number
}

export interface InfiniteScrollHooks {
  /**
   * Requests the next block: the application appends it to the end of `data`. A promise means
   * pending (a tail of skeleton rows) and failure (an error row with retry).
   */
  onLoadMore: (context: InfiniteScrollLoadContext) => Promise<void> | void
}

export type InfiniteScrollStatus = 'idle' | 'pending' | 'error'

export interface InfiniteScrollState {
  status: InfiniteScrollStatus
  /** Скелет-строк в хвосте ожидания. */
  tailRows: number
  /** Причина отказа: `message` ошибки из `onLoadMore`. */
  reason?: string
}
