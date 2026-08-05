import { createColumnHelper } from '@tanstack/react-table'

import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'

const columnHelper = createColumnHelper<any>()

export const COLUMN_SELECTION_ID = getActionColumnId('rowSelection')

const rowSelectionColumn = columnHelper.accessor(COLUMN_SELECTION_ID, {
  id: COLUMN_SELECTION_ID,
  minSize: COLUMN_ACTIONS_SIZE,
  size: COLUMN_ACTIONS_SIZE,
  enablePinning: false,
  enableSorting: false,
  enableResizing: false,
  enableDragging: false,
})

export const getRowSelectionColumn = (depth: number) => {
  if (depth <= 1) {
    return rowSelectionColumn
  }

  return Array.from({ length: depth - 1 }).reduceRight(
    (currentChild, _, index) => {
      return {
        id: `${COLUMN_SELECTION_ID}-group-level-${index}`,
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }
    },
    rowSelectionColumn,
  )
}
