import { useCallback, useEffect, useRef } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

import type { Table } from '../../types'
import { useTableState } from '../reactivity'
import { useColumnRangeExtractor } from './columnRangeExtractor'

export interface ColumnVirtualizerParams {
  table: Table<any, any>
  getScrollElement: () => HTMLDivElement | null
  enabled?: boolean
}

const COLUMNS_OVERSCAN = 4

export const useColumnVirtualizer = ({
  table,
  getScrollElement,
  enabled = true,
}: ColumnVirtualizerParams) => {
  const visibleColumns = table.getVisibleLeafColumns()

  const columnsRef = useRef(visibleColumns)
  columnsRef.current = visibleColumns

  const getEstimateSize = useCallback(
    (index: number) => columnsRef.current[index].getSize(),
    [],
  )

  const getItemKey = useCallback(
    (index: number) => columnsRef.current[index].id,
    [],
  )

  const rangeExtractor = useColumnRangeExtractor({ table })

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: columnsRef.current.length,
    estimateSize: getEstimateSize,
    getItemKey,
    getScrollElement,
    horizontal: true,
    enabled,
    overscan: COLUMNS_OVERSCAN,
    rangeExtractor,
  })

  // columnResizing — срез плагина columnResizing (в v9 sizing/resizing разделены):
  // при отсутствии плагина среза нет в store, читаем isResizingColumn с ?.
  const isResizingColumn = useTableState(
    table,
    state => (state as any).columnResizing?.isResizingColumn ?? false,
  )
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true

      return
    }

    if (!isResizingColumn) {
      virtualizer.measure()
    }
  }, [isResizingColumn, virtualizer])

  return {
    virtualColumns: virtualizer.getVirtualItems(),
    bodyWidth: virtualizer.getTotalSize(),
  }
}
