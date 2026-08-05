import type { SortDirection } from '@tanstack/react-table'

export type ColumnSortingPluginScope = 'columnSorting'

export interface ColumnSortingPluginParams {
  onToggleColumnSort: (id: string, sortDirection: SortDirection | false) => void
}

export type ColumnSortingPlugin = Record<
  ColumnSortingPluginScope,
  ColumnSortingPluginParams
>
