import { useCallback, useMemo, useRef } from 'react'

import { Table } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

import { ESTIMATE_SIZE } from './measureRows'
import { rowMeasureElement } from './rowMeasureElement'
import { useRowRangeExtractor } from './rowRangeExtractor'

const ROWS_OVERSCAN = 5

export interface RowVirtualizerParams {
  table: Table
  getScrollElement: () => HTMLDivElement | null
}

export const useRowVirtualizer = ({
  table,
  getScrollElement,
}: RowVirtualizerParams) => {
  const { rowDragging } = table.getState()

  const { rows } = table.getRowModel()

  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const rowDraggingIndex = useMemo(() => {
    const index = rowsRef.current.findIndex(
      row => row.id === rowDragging.activeId,
    )

    return index === -1 ? undefined : index
  }, [rowDragging.activeId])

  const getEstimateSize = useCallback(() => {
    return ESTIMATE_SIZE
  }, [])

  const getItemKey = useCallback(
    (index: number) => rowsRef.current[index].id,
    [],
  )

  const rangeExtractor = useRowRangeExtractor({ rowDraggingIndex })

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rowsRef.current.length,
    estimateSize: getEstimateSize,
    getScrollElement,
    measureElement: rowMeasureElement,
    getItemKey,
    overscan: ROWS_OVERSCAN,
    rangeExtractor,
  })

  return {
    virtualRows: virtualizer.getVirtualItems(),
    bodyHeight: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
  }
}
