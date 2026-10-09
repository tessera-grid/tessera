import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

import type { Table } from '../../types'
import { useActiveCellIndex } from '../keyboardNavigation'
import { useTableState } from '../reactivity'
import { ESTIMATE_SIZE } from './measureRows'
import { rowMeasureElement } from './rowMeasureElement'
import { useRowRangeExtractor } from './rowRangeExtractor'

const ROWS_OVERSCAN = 5

export interface RowVirtualizerParams {
  table: Table<any, any>
  getScrollElement: () => HTMLDivElement | null
  /** Высота строки, px — оценка для ещё не замеренных строк (ADR 0077). */
  rowHeight?: number
}

export const useRowVirtualizer = ({
  table,
  getScrollElement,
  rowHeight = ESTIMATE_SIZE,
}: RowVirtualizerParams) => {
  // rowDragging — uncontrolled слайс плагина rowDragging: при отсутствии
  // плагина среза нет в store, поэтому читаем activeId проекцией с ?.
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

  const getEstimateSize = useCallback(() => rowHeight, [rowHeight])

  const getItemKey = useCallback(
    (index: number) => rowsRef.current[index].id,
    [],
  )

  const activeRowIndex = useActiveCellIndex(table, 'rowIndex')

  const rangeExtractor = useRowRangeExtractor({
    rowDraggingIndex,
    activeRowIndex,
  })

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rowsRef.current.length,
    estimateSize: getEstimateSize,
    getScrollElement,
    measureElement: rowMeasureElement,
    getItemKey,
    overscan: ROWS_OVERSCAN,
    rangeExtractor,
  })

  // Новая высота: замеры строк прежней высоты больше не верны.
  const measuredHeight = useRef(rowHeight)
  useLayoutEffect(() => {
    if (measuredHeight.current !== rowHeight) {
      measuredHeight.current = rowHeight
      virtualizer.measure()
    }
  }, [rowHeight, virtualizer])

  return {
    virtualRows: virtualizer.getVirtualItems(),
    bodyHeight: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
  }
}
