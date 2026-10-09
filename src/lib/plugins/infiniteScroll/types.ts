export interface InfiniteScrollLoadContext {
  /** Отменяется, когда загрузка устарела: сменились сортировка, фильтры или поиск. */
  signal: AbortSignal
  /** Корневых строк в `data` на момент запроса — смещение следующего блока. */
  loaded: number
}

export interface InfiniteScrollHooks {
  /**
   * Попросить следующий блок: приложение дописывает его в конец `data`. Промис —
   * ожидание (хвост скелет-строк) и отказ (строка ошибки с повтором).
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
