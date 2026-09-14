import { useCallback, useMemo, useRef } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

import type { Table } from '../../types'
import { useTableState } from '../reactivity'
import { ESTIMATE_SIZE } from './measureRows'
import { rowMeasureElement } from './rowMeasureElement'
import { useRowRangeExtractor } from './rowRangeExtractor'

const ROWS_OVERSCAN = 5

export interface RowVirtualizerParams {
  table: Table<any, any>
  getScrollElement: () => HTMLDivElement | null
}

export const useRowVirtualizer = ({
  table,
  getScrollElement,
}: RowVirtualizerParams) => {
  // rowDragging — uncontrolled слайс плагина rowDragging (ADR 0010): при
  // отсутствии плагина среза нет в store, поэтому читаем activeId проекцией с ?.
  const rowDraggingActiveId = useTableState(
    table,
    state => (state as any).rowDragging?.activeId ?? null,
  )

  const { rows } = table.getRowModel()

  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const rowDraggingIndex = useMemo(() => {
    const index = rowsRef.current.findIndex(
      (row: any) => row.id === rowDraggingActiveId,
    )

    return index === -1 ? undefined : index
  }, [rowDraggingActiveId])

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
