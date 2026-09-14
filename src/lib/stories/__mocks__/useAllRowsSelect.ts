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
  const dataIds: string[] = useMemo(
    () =>
      data.reduce<string[]>((acc, item) => {
        return [...acc, item.id]
      }, []),
    [data],
  )

  const getSelectedData = useCallback(
    (selected = true) =>
      dataIds.reduce<RowSelectionState>((acc, itemId): RowSelectionState => {
        return { ...acc, [itemId]: selected } as RowSelectionState
      }, {}),
    [dataIds],
  )

  return {
    getSelectedData,
    selectedDataCount: Object.values(rowSelection).filter(Boolean).length,
  }
}
