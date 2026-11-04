/**
 * Запись плагина infiniteScroll на `definePlugin` (ADR 0081): лента — у края тела
 * грид просит следующий блок, приложение дописывает его в конец `data`. Хвост
 * ожидания — в `bodyEndSlot`, строка ошибки — в `tableEndSlot` (ADR 0118), счётчик —
 * в `statusBarSlot`.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import { InfiniteErrorRow } from './InfiniteErrorRow'
import { InfiniteTail } from './InfiniteTail'
import { LoadedRowsCount } from './LoadedRowsCount'
import {
  IDLE,
  INFINITE_SCROLL,
  infiniteScrollInertReason,
  isLoadingMore,
  ariaRowCountOf,
} from './model'
import type { InfiniteScrollHooks, InfiniteScrollState } from './types'
import { infiniteScrollLabels } from './labels'

export interface InfiniteScrollOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Попросить следующий блок; читается живо. */
  onLoadMore?: InfiniteScrollHooks['onLoadMore']
  /** Есть ли ещё строки на сервере. */
  hasMore?: boolean
  /** За сколько строк до края просить блок; по умолчанию — строк в окне. */
  threshold?: number
  /** Счётчик загруженных строк в нижней панели; по умолчанию выключен. */
  loadedCount?: boolean
}

export const infiniteScroll = definePlugin<InfiniteScrollOptions>()({
  id: INFINITE_SCROLL,
  labels: [infiniteScrollLabels],
  actions: {
    loadMore: labels => infiniteScrollLabels(labels).actionLoadMore,
  },
  diagnose: infiniteScrollInertReason,
  hooks: o => ({ onLoadMore: o.onLoadMore }),
  state: (): InfiniteScrollState => IDLE,
  // Отключённый плагин отдаёт нейтральные значения: v9 сливает опции с прежними.
  options: o => {
    const enabled = o.enabled !== false
    const hasMore = enabled && !!o.hasMore
    return {
      enableInfiniteScroll: enabled,
      infiniteScrollHasMore: hasMore,
      infiniteScrollThreshold: enabled ? o.threshold : undefined,
      getTotalRowCount: enabled ? ariaRowCountOf(hasMore) : undefined,
      getBodyBusy: enabled ? isLoadingMore : undefined,
      partialData: enabled,
      appendOnlyData: enabled,
    }
  },
  slots: o => [
    {
      id: 'infiniteScrollTail',
      slot: 'bodyEndSlot',
      state: true,
      component: InfiniteTail,
    },
    {
      id: 'infiniteScrollError',
      slot: 'tableEndSlot',
      state: true,
      component: InfiniteErrorRow,
    },
    ...(o.loadedCount
      ? [
          {
            id: 'loadedRowsCount',
            slot: 'statusBarSlot' as const,
            align: 'start' as const,
            component: LoadedRowsCount,
          },
        ]
      : []),
  ],
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    infiniteScrollPlugin: {
      enableInfiniteScroll?: boolean
      infiniteScrollHasMore?: boolean
      infiniteScrollThreshold?: number
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
