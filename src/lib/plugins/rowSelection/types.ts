import type { Row } from '@tanstack/react-table'

export type RowSelectionPluginScope = 'rowSelection'

export interface RowSelectionPluginParams {
  onSelectRow: (row: Row<any>, selected: boolean) => void
  onSelectAllRowsOnPage: (selected: boolean) => void
  isAllRowsSelected: boolean
}

export type RowSelectionPlugin = Record<
  RowSelectionPluginScope,
  RowSelectionPluginParams
>
