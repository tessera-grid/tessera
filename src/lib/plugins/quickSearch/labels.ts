/** Подписи `quickSearch` (ADR 0182, §8): ключи словаря таблицы `quickSearch.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface QuickSearchLabels {
  /** Quick search field in the toolbar (`quickSearch`): placeholder and accessible name */
  search: string
  /** Search hint: labels of the columns it searches (ADR 0053) */
  searchColumnsHint: (columns: string[]) => string
  /** Search hint when there is nothing to search */
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
