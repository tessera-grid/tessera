/** Hook-слайс плагина rowSelection. */
import type { Row } from '../../types'

/**
 * Scope of "Select all" in the header (ADR 0179): rows after filters on all pages, the current
 * page, or all data rows, and rows hidden by a filter.
 */
export type SelectAllScope = 'filtered' | 'currentPage' | 'all'

export interface RowSelectionHooks {
  onSelectRow: (row: Row<any, any>, selected: boolean) => void
  /** The header checkbox selected (`true`) or cleared the rows of scope `scope`. */
  onSelectAllRows: (selected: boolean, scope: SelectAllScope) => void
}
