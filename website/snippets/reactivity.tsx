import { useSlice, type CellComponentProps } from '@tessera-grid/tessera'
import { memo } from 'react'

// Re-renders only when the row selection slice changes.
export const SelectedMark = memo(({ row, table }: CellComponentProps) => {
  useSlice(table, 'rowSelection')
  return row.getIsSelected() ? <span aria-hidden>●</span> : null
})
