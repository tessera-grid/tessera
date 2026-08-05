import { useEffect } from 'react'

import { ColumnSizingState, OnChangeFn } from '@tanstack/react-table'

import {
  ROW_ACTIONS_COLUMN_ID,
  RowActionsOptions,
} from './createRowActionsColumn'

interface UseColumnActionsAutosizeParams {
  rowActionsOptions: RowActionsOptions
  onColumnAutoSizingChange: OnChangeFn<ColumnSizingState>
}

export const useColumnActionsAutosize = ({
  rowActionsOptions,
  onColumnAutoSizingChange,
}: UseColumnActionsAutosizeParams) => {
  useEffect(() => {
    onColumnAutoSizingChange(prev => ({
      ...prev,
      [ROW_ACTIONS_COLUMN_ID]: rowActionsOptions.width,
    }))
  }, [onColumnAutoSizingChange, rowActionsOptions.width])
}
