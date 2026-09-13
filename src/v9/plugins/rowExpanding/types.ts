/** Фаза E — hook-слайс плагина rowExpanding (v9). Идентичен v8-контракту. */
import type { Row } from '../../types'

export type RowExpandingPluginScope = 'rowExpanding'

export interface RowExpandingPluginParams {
  onExpandRow: (row: Row<any, any>, expanded: boolean) => void | Promise<any>
}

export type RowExpandingPlugin = Record<
  RowExpandingPluginScope,
  RowExpandingPluginParams
>
