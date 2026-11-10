import { useCallback, useMemo, useRef, useState } from 'react'

import {
  type VirtualItem,
  useVirtualizer,
} from '../../../vendor/tanstack-virtual/react-virtual'

import type { Column, Table } from '../../types'
import { getDisplayColumns } from '../displayColumns'
import { useTableState } from '../reactivity'
import { useColumnRangeExtractor } from './columnRangeExtractor'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { createWindowFlush } from './windowBand'
import { isIncremental } from './windowPortions'
import { useLatest } from '../../util/useLatest'

export interface ColumnVirtualizerParams {
  table: Table<any, any>
  getScrollElement: () => HTMLDivElement | null
  enabled?: boolean
}

const COLUMNS_OVERSCAN = 4

/** Состав окна: ключ, индекс, начало и ширина каждой колонки. */
const windowOf = (items: VirtualItem[]) =>
  items
    .map(({ key, index, start, size }) => `${key}:${index}:${start}:${size}`)
    .join(',')

/** Начала колонок с шириной из `sizes` у тех, что в нём есть, иначе — текущей. */
const startsOf = (
  columns: Column<any, any, unknown>[],
  origin: number,
  sizes?: Map<string, number>,
) => {
  const starts: number[] = []
  let offset = origin
  for (const column of columns) {
    starts.push(offset)
    offset += sizes?.get(column.id) ?? column.getSize()
  }
  return { starts, end: offset }
}

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

  // Порядок отображения мемоизирован (`getDisplayColumns`): колбэки новые только при его смене.
  const getEstimateSize = useCallback(
    (index: number) => displayColumns[index].getSize(),
    [displayColumns],
  )

  const getItemKey = useCallback(
    (index: number) => displayColumns[index].id,
    [displayColumns],
  )

  const rangeExtractor = useColumnRangeExtractor({ table })

  const latestTable = useLatest(table)
  const [windowFlush] = useState(() =>
    createWindowFlush(() => isIncremental(latestTable.current)),
  )
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: displayColumns.length,
    estimateSize: getEstimateSize,
    getItemKey,
    getScrollElement,
    horizontal: true,
    enabled,
    overscan: COLUMNS_OVERSCAN,
    rangeExtractor,
    // Синхронно в событии — только непокрытый край (ADR 0202, §2).
    useFlushSync: windowFlush.flush,
  })

  // columnResizing — срез плагина columnResizing (в v9 sizing/resizing разделены):
  // при отсутствии плагина среза нет в store, читаем isResizingColumn с ?.
  const isResizingColumn = useTableState(
    table,
    state => (state as any).columnResizing?.isResizingColumn ?? false,
  )
  // Ширины протягиваемых колонок на начало протяжки — в них стоит последняя отрисовка тела.
  const sizingStart = useTableState(
    table,
    state =>
      (state as any).columnResizing?.columnSizingStart as
        Array<[string, number]> | undefined,
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

  // Тот же состав окна — прежний массив: строки тела мемоизированы по нему, а
  // react-virtual отдаёт новый при любом пересчёте диапазона (ADR 0099, PF5, PF10).
  const items = virtualizer.getVirtualItems()
  useIsomorphicLayoutEffect(() => {
    windowFlush.show(items.map(item => item.index))
  })
  const windowKey = windowOf(items)
  // Память по составу окна, а не по массиву: `items` новый при каждом пересчёте.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const virtualColumns = useMemo(() => items, [windowKey])

  // Пока тянут грип, тело и шапка не перерисовываются (MemoizedBody): смонтированы колонки
  // окна начала протяжки, даже если колонки прокрутили (CR21), и стоят на смещениях,
  // посчитанных с ширинами начала протяжки, — сдвигаются на разницу текущего начала и
  // того (CR18).
  const [dragWindow, setDragWindow] = useState<VirtualItem[] | null>(null)
  if (isResizingColumn && !dragWindow) setDragWindow(virtualColumns)
  if (!isResizingColumn && dragWindow) setDragWindow(null)
  const columnShifts: Record<string, number> = {}
  const {
    paddingStart = 0,
    paddingEnd = 0,
    scrollMargin = 0,
  } = virtualizer.options
  const origin = paddingStart + scrollMargin
  const now = startsOf(displayColumns, origin)
  // Ширина тела — по ширинам колонок, а не по кэшу виртуализатора: тот пересчитывается в
  // эффекте после отрисовки, и тело, на кадр уже прежнего, поджимало бы прокрутку, если
  // раскладку в этот момент кто-то прочтёт (ADR 0197, RL21).
  const bodyWidth = now.end - scrollMargin + paddingEnd
  if (isResizingColumn) {
    const before = startsOf(displayColumns, origin, new Map(sizingStart))
    for (const { index } of dragWindow ?? virtualColumns) {
      const column = displayColumns[index]
      const shift = column ? now.starts[index] - before.starts[index] : 0
      if (column && shift !== 0) columnShifts[column.id] = shift
    }
  }

  // Начала всех колонок — для заголовков групп, чей первый лист вне окна (ADR 0207, §2).
  const columnStarts = now.starts

  return { virtualColumns, bodyWidth, columnShifts, columnStarts, virtualizer }
}
