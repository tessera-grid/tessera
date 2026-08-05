import { useEffect, useState } from 'react'

import { ColumnSizingState, OnChangeFn } from '@tanstack/react-table'

export const defaultColumnSizingState: ColumnSizingState = {}

export interface ColumnSizingStateReturnType {
  columnSizing: ColumnSizingState
  onColumnSizingChange: OnChangeFn<ColumnSizingState>
}

export const useColumnSizingState = (
  initialColumnSizingState = defaultColumnSizingState,
): ColumnSizingStateReturnType => {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    initialColumnSizingState,
  )

  useEffect(() => {
    setColumnSizing(initialColumnSizingState)
  }, [initialColumnSizingState])

  return { columnSizing, onColumnSizingChange: setColumnSizing }
}
