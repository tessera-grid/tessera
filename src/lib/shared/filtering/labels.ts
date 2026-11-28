/** Подписи `filtering` (ADR 0182, §8): ключи словаря таблицы `filtering.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface FilteringLabels {
  /** Short counter forms in a narrow status bar (ADR 0083, TX6); never truncated */
  filteredRowsShort: (shown: number, total: number) => string
  /** Stub of an empty filtering result */
  noRowsMatchFilters: string
  /** Clear all filters (summary, empty-result stub) */
  resetFilters: string
  /** "Showing N of M" in the status bar */
  filteredRows: (shown: number, total: number) => string
}

export const filteringLabels = defineLabels<FilteringLabels>()(
  'filtering',
  {
    filteredRowsShort: '{shown} / {total}',
    noRowsMatchFilters: 'No rows match the filters',
    resetFilters: 'Reset filters',
    filteredRows: 'Showing {shown} of {total}',
  },
  {
    filteredRowsShort: ['shown', 'total'],
    filteredRows: ['shown', 'total'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    filtering: typeof filteringLabels
  }
}
