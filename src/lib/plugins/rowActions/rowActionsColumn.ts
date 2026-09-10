import { createColumnHelper } from '@tanstack/react-table'

import { ROW_ACTIONS_COLUMN_ID } from '../../core/createColumns'

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
  /**
   * Ширина колонки, когда действия строки схлопнуты в кебаб (`rowActionMenu`):
   * нужен лишь один ⋮, поэтому колонка сужается. См. ADR 0024.
   */
  collapsedWidth: number
}

export const DEFAULT_ROW_ACTIONS_OPTIONS: RowActionsOptions = {
  width: 120,
  collapsedWidth: 56,
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
