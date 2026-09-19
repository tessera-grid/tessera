/** Hook-слайс плагина rowExpanding. */
import type { Row } from '../../types'

export type RowExpandingPluginScope = 'rowExpanding'

export interface RowExpandingPluginParams {
  onExpandRow: (row: Row<any, any>, expanded: boolean) => void | Promise<any>
}

export type RowExpandingPlugin = Record<
  RowExpandingPluginScope,
  RowExpandingPluginParams
>
