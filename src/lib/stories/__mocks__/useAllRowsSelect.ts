import { useCallback, useMemo } from 'react'

import { RowSelectionState } from '@tanstack/react-table'

import {
  isAllSelection,
  type RowSelectionValue,
} from '../../core/rowSelectionAll'

export interface UseAllRowsSelectParams {
  data: Record<string, any>[]
  rowSelection: RowSelectionValue
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
    // «Всё, кроме» серверной модели строк: все строки данных без исключений.
    selectedDataCount: isAllSelection(rowSelection)
      ? rowSelection.all
        ? dataIds.length - rowSelection.except.length
        : rowSelection.except.length
      : Object.values(rowSelection).filter(Boolean).length,
  }
}
