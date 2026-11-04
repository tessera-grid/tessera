/** Подписи `quickSearch` (ADR 0182, §8): ключи словаря таблицы `quickSearch.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface QuickSearchLabels {
  /** Поле быстрого поиска в тулбаре (`quickSearch`): плейсхолдер и доступное имя */
  search: string
  /** Подсказка поиска: подписи колонок, по которым он идёт (ADR 0053) */
  searchColumnsHint: (columns: string[]) => string
  /** Подсказка поиска, когда искать не по чему */
  searchNoColumns: string
}

export const quickSearchLabels = defineLabels<QuickSearchLabels>()(
  'quickSearch',
  {
    search: 'Search',
    searchColumnsHint: 'Search in columns: {columns}',
    searchNoColumns: 'No columns to search',
  },
  {
    searchColumnsHint: ['columns'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    quickSearch: typeof quickSearchLabels
  }
}
