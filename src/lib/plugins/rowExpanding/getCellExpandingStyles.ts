import { Column, Table } from '@tanstack/react-table'

export const EXPANDING_DEPTH_OFFSET_PX = 32

export interface CellExpandingStylesParams {
  column: Column<any, unknown>
  rowDepth: number
  table: Table
}

export const getCellExpandingStyles = ({
  column,
  rowDepth,
  table,
}: CellExpandingStylesParams) => {
  const visibleColumns = table.getVisibleLeafColumns()

  const firstUserColumn = visibleColumns.find(
    visibleColumn => !visibleColumn.getIsActionsColumn(),
  )

  if (firstUserColumn?.id === column.id) {
    return { paddingLeft: EXPANDING_DEPTH_OFFSET_PX * rowDepth }
  }

  return { paddingLeft: undefined }
}
