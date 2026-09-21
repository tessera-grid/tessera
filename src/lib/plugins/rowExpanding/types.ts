/** Hook-слайс плагина rowExpanding. */
import type { Row } from '../../types'

export interface RowExpandingHooks {
  onExpandRow: (row: Row<any, any>, expanded: boolean) => void | Promise<any>
}
