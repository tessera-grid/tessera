import { Column, Table } from '@tanstack/react-table'

import {
  getPinnedLeftOffset,
  getPinnedRightOffset,
} from '../../core/createColumns/calculateColumnSizes'

export interface CellPinningParams {
  table: Table<any>
  column: Column<any>
}

export const useCellPinningParams = ({ table, column }: CellPinningParams) => {
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

  // CSS-смещения через calc() от переменных ширины: пересчитываются браузером
  // при ресайзе соседней закреплённой колонки (см. getPinnedLeftOffset).
  const leftPinnedOffset = isLeftPinned
    ? getPinnedLeftOffset(table, column)
    : undefined
  const rightPinnedOffset = isRightPinned
    ? getPinnedRightOffset(table, column)
    : undefined

  return {
    isLeftPinned,
    isRightPinned,
    isLastLeftPinnedColumn,
    isLastRightPinnedColumn,
    isFirstRightPinnedColumn,
    isAloneRightPinnedColumn,
    leftPinnedOffset,
    rightPinnedOffset,
  }
}
