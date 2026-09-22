import { useCallback, useEffect, useRef } from 'react'

import { useVirtualizer } from '@tanstack/react-virtual'

import type { Column, Table } from '../../types'
import { getDisplayColumns } from '../displayColumns'
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
  // Индексы виртуализатора — в порядке отображения (как ячейки строки и заголовки),
  // иначе размер/ключ закреплённой справа колонки попадает в чужой слот.
  const displayColumns = getDisplayColumns<Column<any, any, unknown>>(
    table as never,
  ).columns

  const columnsRef = useRef(displayColumns)
  columnsRef.current = displayColumns

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
  // estimateSize не входит в мемо-зависимости react-virtual: при смене порядка
  // отображения (закрепление/перестановка) кэш размеров надо сбросить явно.
  const orderMountedRef = useRef(false)
  useEffect(() => {
    if (!orderMountedRef.current) {
      orderMountedRef.current = true

      return
    }

    virtualizer.measure()
  }, [displayColumns, virtualizer])

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
