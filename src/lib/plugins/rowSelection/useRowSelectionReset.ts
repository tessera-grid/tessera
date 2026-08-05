import { useEffect } from 'react'

import { Table } from '@tanstack/react-table'

export interface UseRowSelectionResetParams<TData> {
  table: Table<TData>
}

export const useRowSelectionReset = <TData>({
  table,
}: UseRowSelectionResetParams<TData>) => {
  useEffect(() => {
    table.resetRowSelection(true)
  }, [
    table,
    table.options.enableRowSelection,
    table.options.enableSubRowSelection,
    table.options.manualExpanding,
  ])
}
