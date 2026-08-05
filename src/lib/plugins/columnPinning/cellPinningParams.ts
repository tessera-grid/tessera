import { Column } from '@tanstack/react-table'

export interface CellPinningParams {
  column: Column<any>
}

export const useCellPinningParams = ({ column }: CellPinningParams) => {
  const isPinned = column.getIsPinned()

  const isLeftPinned = isPinned === 'left'
  const isRightPinned = isPinned === 'right'

  const isLastLeftPinnedColumn = isLeftPinned && column.getIsLastColumn('left')
  const isLastRightPinnedColumn =
    isRightPinned && column.getIsLastColumn('right')
  const isAloneRightPinnedColumn =
    isLastRightPinnedColumn && column.getIndex('right') === 0

  const isFirstRightPinnedColumn =
    isRightPinned && column.getIndex('right') === 0

  const getStartLeft = column.getStart('left')
  const getAfterRight = column.getAfter('right')

  return {
    isLeftPinned,
    isRightPinned,
    isLastLeftPinnedColumn,
    isLastRightPinnedColumn,
    isFirstRightPinnedColumn,
    isAloneRightPinnedColumn,
    getStartLeft,
    getAfterRight,
  }
}
