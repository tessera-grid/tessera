/** Hook-слайс плагина columnSorting. */
import type { SortDirection } from '@tanstack/react-table'

export interface ColumnSortingHooks {
  onToggleColumnSort: (id: string, sortDirection: SortDirection | false) => void
}
