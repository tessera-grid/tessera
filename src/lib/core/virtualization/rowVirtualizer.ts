import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

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
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { scrollLayer } from '../scrollStretch'
import { firstChangedIndex, type RowBuild, rowBuildOf } from '../rowChanges'
import { followIndex } from '../rowListFollow'
import { scrollGridTo } from '../scrollGridTo'

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
  // Источник клиента — один объект на таблицу: список строк — свой на каждую модель.
  const list = rows.keyByIndex ? undefined : rows.rows?.()
  const getItemKey = useMemo(() => {
    if (rows.keyByIndex) return (index: number) => index
    return list
      ? (index: number) => list[index]?.id ?? index
      : (index: number) => rows.at(index)?.id ?? index
  }, [rows, list])

  // Место первого изменения строк с прошлой сборки позиций (ADR 0145): виртуализатор
  // спрашивает его на каждой сборке.
  const built = useRef<RowBuild | undefined>(undefined)
  const getFirstChangedIndex = useCallback(() => {
    const next = rowBuildOf(table, list)
    const previous = built.current
    built.current = next
    return previous ? firstChangedIndex(table, previous, next) : undefined
  }, [table, list])

  const activeRowIndex = useActiveCellIndex(table, 'rowIndex')

  // Строка активной ячейки — по её `id`: новый `data` клиента сдвигает строку раньше, чем
  // ячейка переезжает за ней после коммита (ADR 0194, IU12), — строка с фокусом остаётся в окне.
  const [held, setHeld] = useState<{
    list: readonly { id: string }[] | undefined
    index: number | undefined
    /** Строка, что стояла на месте активной ячейки до смены списка. */
    pin: string | undefined
  }>({ list, index: activeRowIndex, pin: undefined })
  if (held.list !== list) {
    setHeld({
      list,
      index: activeRowIndex,
      pin: held.index === undefined ? undefined : held.list?.[held.index]?.id,
    })
  } else if (held.index !== activeRowIndex) {
    setHeld({ list, index: activeRowIndex, pin: undefined })
  }
  const heldRowIndex =
    held.pin === undefined ? undefined : rows.indexOf(held.pin)

  const rangeExtractor = useRowRangeExtractor({
    rowDraggingIndex,
    activeRowIndex,
    heldRowIndex,
  })

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.count(),
    estimateSize: getEstimateSize,
    getScrollElement,
    measureElement: rowMeasureElement,
    getItemKey,
    getFirstChangedIndex,
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

  // Строки выше экрана вставлены или удалены — прокрутка держит первую строку экрана
  // (ADR 0157, §3); у начала списка, как якорь прокрутки браузера, не держит.
  const listSeen = useRef<{ epoch: number; version: number } | undefined>(
    undefined,
  )
  useIsomorphicLayoutEffect(() => {
    const version = rows.version?.()
    if (version === undefined) {
      listSeen.current = undefined
      return
    }
    const epoch = rows.epoch?.() ?? 0
    const before = listSeen.current
    listSeen.current = { epoch, version }
    if (!before || before.epoch !== epoch || before.version === version) return
    const scroller = getScrollElement()
    const batches = rows.changesSince?.(before.version)
    if (!scroller || !batches) return
    const top = scrollLayer(scroller).top()
    if (top <= 0) return
    const anchor = Math.floor(top / rowHeight)
    const moved = followIndex(anchor, batches) - anchor
    if (moved)
      scrollGridTo(scroller, { top: top + moved * rowHeight }, 'instant')
  })

  // Клиент: новый `data` — прокрутка держит первую строку экрана, что осталась в списке
  // (ADR 0194, IU12); смена порядка без нового `data` (сортировка) прокрутку не держит.
  const clientSeen = useRef<
    { data: unknown; list: readonly { id: string }[] } | undefined
  >(undefined)
  useIsomorphicLayoutEffect(() => {
    if (rows.keyByIndex || !list) {
      clientSeen.current = undefined
      return
    }
    const data: unknown = table.options.data
    const before = clientSeen.current
    clientSeen.current = { data, list }
    if (!before || before.data === data || before.list === list) return
    const scroller = getScrollElement()
    if (!scroller) return
    const top = scrollLayer(scroller).top()
    if (top <= 0) return
    const anchor = Math.floor(top / rowHeight)
    for (let k = anchor; k < before.list.length; k++) {
      const at = rows.indexOf(before.list[k]!.id)
      if (at < 0) continue
      if (at !== k) {
        scrollGridTo(scroller, { top: top + (at - k) * rowHeight }, 'instant')
      }
      return
    }
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
