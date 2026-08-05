import { useEffect, useState } from 'react'

import { OnChangeFn, RowSelectionState } from '@tanstack/react-table'

export const defaultRowSelectionState: RowSelectionState = {}

export interface RowSelectionStateReturnType {
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
}

export const useRowSelectionState = (
  initialRowSelectionState = defaultRowSelectionState,
): RowSelectionStateReturnType => {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(
    initialRowSelectionState,
  )

  useEffect(() => {
    setRowSelection(initialRowSelectionState)
  }, [initialRowSelectionState])

  return {
    rowSelection,
    onRowSelectionChange: setRowSelection,
  }
}
