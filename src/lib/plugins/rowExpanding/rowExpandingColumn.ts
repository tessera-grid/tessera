import { createColumnHelper } from '@tanstack/react-table'

import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'

const columnHelper = createColumnHelper<any>()

export const COLUMN_EXPANDING_ID = getActionColumnId('rowExpanding')

const rowExpandingColumn = columnHelper.accessor('id', {
  id: COLUMN_EXPANDING_ID,
  minSize: COLUMN_ACTIONS_SIZE,
  size: COLUMN_ACTIONS_SIZE,
  header: undefined,
  enablePinning: false,
  enableSorting: false,
  enableResizing: false,
  enableDragging: false,
})

export const getRowExpandingColumn = (depth: number) => {
  if (depth <= 1) {
    return rowExpandingColumn
  }

  return Array.from({ length: depth - 1 }).reduceRight(
    (currentChild, _, index) => {
      return {
        id: `${COLUMN_EXPANDING_ID}-group-level-${index}`,
        header: '',
        rowSpan: index === 0 ? depth - 1 : 0,
        columns: [currentChild],
      }
    },
    rowExpandingColumn,
  )
}
