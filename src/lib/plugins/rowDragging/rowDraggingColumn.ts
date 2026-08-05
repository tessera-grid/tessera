import { createColumnHelper } from '@tanstack/react-table'

import {
  ACTION_COLUMN_CONTENT_PADDING,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'

const columnHelper = createColumnHelper<any>()

/** Drag handle icon side (see `DragHandler.module.css`). */
const DRAG_ICON_SIZE = 16

export const COLUMN_DRAGGING_ID = getActionColumnId('rowDragging')
// icon (16) + left padding (4) + right padding (4) = 24
export const COLUMN_DRAGGING_SIZE =
  DRAG_ICON_SIZE + ACTION_COLUMN_CONTENT_PADDING * 2

const rowDraggingColumn = columnHelper.accessor('id', {
  id: COLUMN_DRAGGING_ID,
  minSize: COLUMN_DRAGGING_SIZE,
  size: COLUMN_DRAGGING_SIZE,
  header: undefined,
  cell: undefined,
  enablePinning: false,
  enableSorting: false,
  enableResizing: false,
  enableDragging: false,
})

export const getRowDraggingColumn = (depth: number) => {
  if (depth <= 1) {
    return rowDraggingColumn
  }

  return Array.from({ length: depth - 1 }).reduceRight(
    (currentChild, _, index) => {
      return {
        id: `${COLUMN_DRAGGING_ID}-group-level-${index}`,
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }
    },
    rowDraggingColumn,
  )
}
