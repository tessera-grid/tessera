/** Hook-слайс плагина rowSelection. */
import type { Row } from '../../types'

export interface RowSelectionHooks {
  onSelectRow: (row: Row<any, any>, selected: boolean) => void
  onSelectAllRowsOnPage: (selected: boolean) => void
  isAllRowsSelected: boolean
}
