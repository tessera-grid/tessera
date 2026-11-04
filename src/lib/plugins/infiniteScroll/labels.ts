/** Подписи `infiniteScroll` (ADR 0182, §8): ключи словаря таблицы `infiniteScroll.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface InfiniteScrollLabels {
  /** Счётчик загруженных строк в нижней панели (`infiniteScroll({ loadedCount })`): итог неизвестен и известен */
  loadedRows: (count: number) => string
  loadedRowsOf: (count: number, total: number) => string
  /** Короткие формы счётчиков в узкой нижней панели (ADR 0083, TX6); не обрезаются */
  loadedRowsShort: (count: number) => string
  loadedRowsOfShort: (count: number, total: number) => string
  /** Строка ошибки догрузки (ADR 0081): текст и кнопка повтора */
  loadMoreFailed: string
  /** Объявление прихода блока догрузки */
  announceMoreLoaded: (count: number) => string
  /** Действие: загрузить порцию строк */
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
