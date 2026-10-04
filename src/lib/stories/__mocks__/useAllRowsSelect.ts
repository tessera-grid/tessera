import { useCallback, useMemo } from 'react'

import { RowSelectionState } from '@tanstack/react-table'

export interface UseAllRowsSelectParams {
  data: Record<string, any>[]
  rowSelection: RowSelectionState
}

export const useAllRowsSelect = ({
  data,
  rowSelection,
}: UseAllRowsSelectParams) => {
  const dataIds: string[] = useMemo(() => data.map(item => item.id), [data])

  const getSelectedData = useCallback(
    (selected = true) =>
      Object.fromEntries(
        dataIds.map(itemId => [itemId, selected]),
      ) as RowSelectionState,
    [dataIds],
  )

  return {
    getSelectedData,
    selectedDataCount: Object.values(rowSelection).filter(Boolean).length,
  }
}
