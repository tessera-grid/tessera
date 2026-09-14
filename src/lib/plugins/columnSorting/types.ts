/** Фаза E — hook-слайс плагина columnSorting (v9). Идентичен v8-контракту. */
import type { SortDirection } from '@tanstack/react-table'

export type ColumnSortingPluginScope = 'columnSorting'

export interface ColumnSortingPluginParams {
  onToggleColumnSort: (id: string, sortDirection: SortDirection | false) => void
}

export type ColumnSortingPlugin = Record<
  ColumnSortingPluginScope,
  ColumnSortingPluginParams
>
