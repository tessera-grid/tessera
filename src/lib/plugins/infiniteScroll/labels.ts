/** Подписи `infiniteScroll` (ADR 0182, §8): ключи словаря таблицы `infiniteScroll.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface InfiniteScrollLabels {
  /** Loaded row counter in the status bar (`infiniteScroll({ loadedCount })`): total unknown and known */
  loadedRows: (count: number) => string
  loadedRowsOf: (count: number, total: number) => string
  /** Short counter forms in a narrow status bar (ADR 0083, TX6); never truncated */
  loadedRowsShort: (count: number) => string
  loadedRowsOfShort: (count: number, total: number) => string
  /** Load-more error row (ADR 0081): text and the retry button */
  loadMoreFailed: string
  /** Announcement that a load-more block arrived */
  announceMoreLoaded: (count: number) => string
  /** Action: load a batch of rows */
  actionLoadMore: string
}

export const infiniteScrollLabels = defineLabels<InfiniteScrollLabels>()(
  'infiniteScroll',
  {
    loadedRows: 'Loaded {count}',
    loadedRowsOf: 'Loaded {count} of {total}',
    loadMoreFailed: "Couldn't load more rows",
    announceMoreLoaded: 'Loaded {count} more rows',
    announceMoreLoaded_one: 'Loaded {count} more row',
    loadedRowsShort: '{count}',
    loadedRowsOfShort: '{count} / {total}',
    actionLoadMore: 'Load more rows',
  },
  {
    loadedRows: ['count'],
    loadedRowsOf: ['count', 'total'],
    loadedRowsShort: ['count'],
    loadedRowsOfShort: ['count', 'total'],
    announceMoreLoaded: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    infiniteScroll: typeof infiniteScrollLabels
  }
}
