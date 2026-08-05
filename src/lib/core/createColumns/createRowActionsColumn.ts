import { createColumnHelper } from '@tanstack/react-table'

import { getActionColumnId } from './actionColumnParams'

export const ROW_ACTIONS_COLUMN_ID = getActionColumnId('rowActions')

const columnHelper = createColumnHelper<any>()

const rowActionsColumn = columnHelper.accessor(ROW_ACTIONS_COLUMN_ID, {
  id: ROW_ACTIONS_COLUMN_ID,
  minSize: 0,
  size: 0,
  header: undefined,
  enablePinning: false,
  enableSorting: false,
  enableResizing: false,
  enableDragging: false,
})

export interface RowActionsOptions {
  width: number
}

export const DEFAULT_ROW_ACTIONS_OPTIONS: RowActionsOptions = {
  width: 120,
}

export const getRowActionsColumn = (depth: number) => {
  if (depth <= 1) {
    return rowActionsColumn
  }

  return Array.from({ length: depth - 1 }).reduceRight(
    (currentChild, _, index) => {
      return {
        id: `${ROW_ACTIONS_COLUMN_ID}-group-level-${index}`,
        header: '',
        columns: [currentChild],
      }
    },
    rowActionsColumn,
  )
}
