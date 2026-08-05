import { useEffect, useState } from 'react'

import { GroupingState, OnChangeFn } from '@tanstack/react-table'

export const defaultRowGroupingState: GroupingState = []

export interface ColumnSizingStateReturnType {
  grouping: GroupingState
  onGroupingChange: OnChangeFn<GroupingState>
}

export const useRowGroupingState = (
  initialRowGroupingState = defaultRowGroupingState,
): ColumnSizingStateReturnType => {
  const [grouping, setGrouping] = useState<GroupingState>(
    initialRowGroupingState,
  )

  useEffect(() => {
    setGrouping(initialRowGroupingState)
  }, [initialRowGroupingState])

  return { grouping, onGroupingChange: setGrouping }
}
