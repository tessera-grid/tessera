/** Hook-слайс плагина columnSorting. */
import type { SortDirection } from '@tanstack/react-table'

import type {
  ServerActionContext,
  ServerActionResult,
} from '../../core/serverActions'

export interface ColumnSortingHooks {
  /**
   * Пользователь сменил сортировку колонки. В серверном режиме промис — запрос данных
   * под неё: грид ждёт, отказ откатывает сортировку (ADR 0116).
   */
  onToggleColumnSort: (
    id: string,
    sortDirection: SortDirection | false,
    context: ServerActionContext,
  ) => ServerActionResult
}
