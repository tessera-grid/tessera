/** Фаза E — hook-слайс плагина rowSelection (v9). Идентичен v8-контракту. */
import type { Row } from '../../types'

export type RowSelectionPluginScope = 'rowSelection'

export interface RowSelectionPluginParams {
  onSelectRow: (row: Row<any, any>, selected: boolean) => void
  onSelectAllRowsOnPage: (selected: boolean) => void
  isAllRowsSelected: boolean
}

export type RowSelectionPlugin = Record<
  RowSelectionPluginScope,
  RowSelectionPluginParams
>
