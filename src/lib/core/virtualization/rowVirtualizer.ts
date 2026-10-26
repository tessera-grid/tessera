import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'

import {
  type VirtualItem,
  useVirtualizer,
} from '../../../vendor/tanstack-virtual/react-virtual'

import type { Table } from '../../types'
import { useActiveCellIndex } from '../keyboardNavigation'
import { useTableState } from '../reactivity'
import { ESTIMATE_SIZE } from './measureRows'
import { rowMeasureElement } from './rowMeasureElement'
import { useRowRangeExtractor } from './rowRangeExtractor'
import { useIsomorphicLayoutEffect } from '../useIsomorphicLayoutEffect'
import { scrollLayer } from '../scrollStretch'

const ROWS_OVERSCAN = 5
/** Строка растянутой области на экране — по объекту строки виртуализатора. */
const shifted = new WeakMap<VirtualItem, VirtualItem>()
/** Строка дальше стольких экранов от видимой области стоит на этом расстоянии. */
const FAR_SCREENS = 4

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

  const rows = table.getRowSource()

  const rowDraggingIndex = useMemo(() => {
    if (rowDraggingActiveId === null) return undefined
    const index = rows.indexOf(rowDraggingActiveId)

    return index === -1 ? undefined : index
  }, [rows, rowDraggingActiveId])

  const getEstimateSize = useCallback(() => rowHeight, [rowHeight])

  // Серверная модель строк — по индексу (ADR 0138, §14); незагруженная строка — тоже.
  // Виртуализатор сверяет ключи начала списка на каждой смене строк (ADR 0143): массив
  // строк — один раз, а не модель на каждый индекс.
  const getItemKey = useMemo(() => {
    if (rows.keyByIndex) return (index: number) => index
    const list = rows.rows?.()
    return list
      ? (index: number) => list[index]?.id ?? index
      : (index: number) => rows.at(index)?.id ?? index
  }, [rows])

  const activeRowIndex = useActiveCellIndex(table, 'rowIndex')

  const rangeExtractor = useRowRangeExtractor({
    rowDraggingIndex,
    activeRowIndex,
  })

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.count(),
    estimateSize: getEstimateSize,
    getScrollElement,
    measureElement: rowMeasureElement,
    getItemKey,
    overscan: ROWS_OVERSCAN,
    rangeExtractor,
    // Позиция — виртуальная, из слоя растяжки (ADR 0142).
    observeElementOffset: (instance, onOffset) =>
      instance.scrollElement
        ? scrollLayer(instance.scrollElement).subscribe(onOffset)
        : undefined,
    scrollToFn: (offset, { adjustments = 0, behavior }, instance) => {
      if (!instance.scrollElement) return
      scrollLayer(instance.scrollElement).scrollTo(
        { top: offset + adjustments },
        behavior === 'smooth' ? 'smooth' : 'instant',
      )
    },
  })

  // Новая высота: замеры строк прежней высоты больше не верны.
  const measuredHeight = useRef(rowHeight)
  useIsomorphicLayoutEffect(() => {
    if (measuredHeight.current !== rowHeight) {
      measuredHeight.current = rowHeight
      virtualizer.measure()
    }
  }, [rowHeight, virtualizer])

  // Строки на экране — от фактической прокрутки: в растянутой области их виртуальное
  // начало минус база сдвига слоя, остаток слой ставит сам. Строки далеко за экраном
  // (активная, перетаскиваемая) — не дальше нескольких экранов: место за пределом
  // браузера он обрезает или обнуляет.
  const items = virtualizer.getVirtualItems()
  const scroller = getScrollElement()
  const layer = scroller ? scrollLayer(scroller) : undefined
  const subscribeBase = useCallback(
    (listener: () => void) => layer?.onBase(listener) ?? (() => {}),
    [layer],
  )
  const base = useSyncExternalStore(
    subscribeBase,
    () => layer?.rowShift() ?? 0,
    () => 0,
  )
  const virtualRows =
    !scroller || !layer?.stretched
      ? items
      : items.map(item => {
          const near = layer.top() - base
          const reach = scroller.clientHeight * FAR_SCREENS
          const start = Math.min(
            Math.max(item.start - base, near - reach),
            near + reach,
          )
          // Тот же объект, пока место строки прежнее: строки мемоизированы по нему.
          const known = shifted.get(item)
          if (known?.start === start) return known
          const row = { ...item, start, end: start + item.size }
          shifted.set(item, row)
          return row
        })
  // Новые строки получают остаток сдвига до кадра.
  useIsomorphicLayoutEffect(() => {
    layer?.commitBase(base)
  })

  return {
    virtualRows,
    bodyHeight: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
    virtualizer,
  }
}
