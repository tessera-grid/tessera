import { Column, Table } from '@tanstack/react-table'

import { ROW_NESTING_INDENT_PX } from '../../core/rowNesting'

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
    return { paddingLeft: ROW_NESTING_INDENT_PX * rowDepth }
  }

  return { paddingLeft: undefined }
}
