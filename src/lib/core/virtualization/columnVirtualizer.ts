import { useCallback, useRef } from 'react'

import {
  type VirtualItem,
  useVirtualizer,
} from '../../../vendor/tanstack-virtual/react-virtual'

import type { Column, Table } from '../../types'
import { getDisplayColumns } from '../displayColumns'
import { useTableState } from '../reactivity'
import { useColumnRangeExtractor } from './columnRangeExtractor'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'

export interface ColumnVirtualizerParams {
  table: Table<any, any>
  getScrollElement: () => HTMLDivElement | null
  enabled?: boolean
}

const COLUMNS_OVERSCAN = 4

const sameWindow = (a: VirtualItem[], b: VirtualItem[]) =>
  a.length === b.length &&
  a.every(
    (item, i) =>
      item.key === b[i].key &&
      item.index === b[i].index &&
      item.start === b[i].start &&
      item.size === b[i].size,
  )

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
  // Ширина, заданная без протяжки (стрелки сплиттера, меню грипа, сброс), тоже
  // сдвигает соседние колонки.
  const columnSizing = useTableState(
    table,
    state => (state as any).columnSizing,
  )
  // estimateSize не входит в мемо-зависимости react-virtual: при смене порядка
  // отображения (закрепление/перестановка) кэш размеров надо сбросить явно.
  const orderMountedRef = useRef(false)
  useIsomorphicLayoutEffect(() => {
    if (!orderMountedRef.current) {
      orderMountedRef.current = true

      return
    }

    virtualizer.measure()
  }, [displayColumns, virtualizer])

  const mountedRef = useRef(false)

  // До отрисовки кадра: иначе кадр с новой шириной колонки и прежними соседями.
  useIsomorphicLayoutEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true

      return
    }

    if (!isResizingColumn) {
      virtualizer.measure()
    }
  }, [isResizingColumn, columnSizing, virtualizer])

  // Пока тянут грип, тело и шапка не перерисовываются (MemoizedBody) и стоят на
  // смещениях последней отрисовки до протяжки — смонтированные колонки сдвигаются на
  // разницу текущего смещения и того (CR18). Снимок — копия: кэш размеров
  // react-virtual переиспользует один массив и меняет его при пересчёте.
  // Тот же состав окна — прежний массив: строки тела мемоизированы по нему, а
  // react-virtual отдаёт новый при любом пересчёте диапазона (ADR 0099, PF5, PF10).
  const items = virtualizer.getVirtualItems()
  const stable = useRef(items)
  if (!sameWindow(stable.current, items)) stable.current = items
  const virtualColumns = stable.current
  const rendered = useRef<{ index: number; start: number }[]>([])
  if (!isResizingColumn) {
    rendered.current = virtualColumns.map(({ index, start }) => ({
      index,
      start,
    }))
  }
  const columnShifts: Record<string, number> = {}
  let bodyWidth = virtualizer.getTotalSize()
  if (isResizingColumn) {
    const { paddingStart = 0, scrollMargin = 0 } = virtualizer.options
    const starts: number[] = []
    let offset = paddingStart + scrollMargin
    for (const column of columnsRef.current) {
      starts.push(offset)
      offset += column.getSize()
    }
    bodyWidth = offset - scrollMargin
    for (const { index, start } of rendered.current) {
      const column = columnsRef.current[index]
      const shift = column ? starts[index] - start : 0
      if (column && shift !== 0) columnShifts[column.id] = shift
    }
  }

  return { virtualColumns, bodyWidth, columnShifts, virtualizer }
}
