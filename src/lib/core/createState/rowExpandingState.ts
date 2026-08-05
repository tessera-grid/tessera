import { useEffect, useState } from 'react'

import { ExpandedState, OnChangeFn } from '@tanstack/react-table'

export const defaultExpandedState: ExpandedState = {} as ExpandedState

export interface RowExpandingStateReturnType {
  rowExpanded: ExpandedState
  onRowExpandedChange: OnChangeFn<ExpandedState>
}

export const useRowExpandingState = (
  initialExpandedState = defaultExpandedState,
): RowExpandingStateReturnType => {
  const [rowExpanded, setRowExpanded] =
    useState<ExpandedState>(initialExpandedState)

  useEffect(() => {
    setRowExpanded(initialExpandedState)
  }, [initialExpandedState])

  return { rowExpanded, onRowExpandedChange: setRowExpanded }
}
