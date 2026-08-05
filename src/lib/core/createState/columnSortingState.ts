import { useEffect, useState } from 'react'

import { ColumnSort, OnChangeFn } from '@tanstack/react-table'

export const defaultColumnSortingState: ColumnSort[] = []

export interface ColumnSortingStateReturnType {
  columnSorting: ColumnSort[]
  onColumnSortingChange: OnChangeFn<ColumnSort[]>
}

export const useColumnSortingState = (
  initialColumnSortingState = defaultColumnSortingState,
): ColumnSortingStateReturnType => {
  const [columnSorting, setColumnSorting] = useState<ColumnSort[]>(
    initialColumnSortingState,
  )

  useEffect(() => {
    setColumnSorting(initialColumnSortingState)
  }, [initialColumnSortingState])

  return { columnSorting, onColumnSortingChange: setColumnSorting }
}
