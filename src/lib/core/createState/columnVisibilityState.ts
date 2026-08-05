import { useEffect, useState } from 'react'

import { OnChangeFn, VisibilityState } from '@tanstack/react-table'

export const defaultColumnVisibilityState: VisibilityState = {}

export interface ColumnVisibilityStateReturnType {
  columnVisibility?: VisibilityState
  onColumnVisibilityChange: OnChangeFn<VisibilityState>
}

export const useColumnVisibilityState = (
  initialColumnVisibilityState = defaultColumnVisibilityState,
): ColumnVisibilityStateReturnType => {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    initialColumnVisibilityState,
  )

  useEffect(() => {
    setColumnVisibility(initialColumnVisibilityState)
  }, [initialColumnVisibilityState])

  return { columnVisibility, onColumnVisibilityChange: setColumnVisibility }
}
