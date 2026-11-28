/** Hook-слайс плагина columnSorting. */
import type { SortDirection } from '@tanstack/react-table'

import type {
  ServerActionContext,
  ServerActionResult,
} from '../../core/serverActions'

export interface ColumnSortingHooks {
  /**
   * The user changed a column's sort. In server mode a promise is the data request for it: the
   * grid waits, a rejection reverts the sort (ADR 0116).
   */
  onToggleColumnSort: (
    id: string,
    sortDirection: SortDirection | false,
    context: ServerActionContext,
  ) => ServerActionResult
}
