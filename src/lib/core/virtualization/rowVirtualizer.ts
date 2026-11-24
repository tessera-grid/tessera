import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { flushSync } from 'react-dom'

import {
  type VirtualItem,
  type Virtualizer,
  useVirtualizer,
} from '../../../vendor/tanstack-virtual/react-virtual'

import type { Table } from '../../types'
import { useActiveCellIndex } from '../keyboardNavigation'
import { useTableState } from '../reactivity'
import { ESTIMATE_SIZE } from './measureRows'
import { rowMeasureElement } from './rowMeasureElement'
import { useRowRangeExtractor } from './rowRangeExtractor'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { createWindowBand, createWindowFlush, useBandRest } from './windowBand'
import { isIncremental } from './windowPortions'
import { useLatest } from '../../util/useLatest'
import { scrollLayer } from '../scrollStretch'
import { firstChangedIndex, type RowBuild, rowBuildOf } from '../rowChanges'
import { followIndex } from '../rowListFollow'
import { scrollGridTo } from '../scrollGridTo'
import {
  estimatedRowHeightOf,
  rowNeedsOf,
  rowSizeOf,
  subscribeRowSizes,
} from '../rowSizes'

const ROWS_OVERSCAN = 5
/** Строк по обе стороны окна, чьи высоты объявляются заново после сброса замеров. */
const ANNOUNCE_SPAN = 200
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

  // Размер строки — по высоте её содержимого (ADR 0218, §4). Источник строк читает текущую
  // модель, функция оценки постоянна: её смена пересчитывала бы все места (ADR 0143, §3).
  const [needs] = useState(() => rowNeedsOf(table))
  const estimate = estimatedRowHeightOf(table)
  // Ключ строки — индекс (ADR 0138, §14): высота строки — только через `resizeItem`, кэш
  // виртуализатора по индексу переживает уход блока. Оценка по id применяла бы высоту
  // перезагруженной строки молча, без поправки прокрутки.
  const getEstimateSize = useCallback(
    (index: number) =>
      (needs.size === 0 && estimate === undefined) || rows.keyByIndex
        ? (estimate ?? rowHeight)
        : rowSizeOf(needs, rows.at(index)?.id, rowHeight, estimate),
    [needs, rows, rowHeight, estimate],
  )

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
  const data = list ? table.options.data : undefined
  const [held, setHeld] = useState<{
    data: typeof data
    list: readonly { id: string }[] | undefined
    index: number | undefined
    /** Строка, что стояла на месте активной ячейки до смены списка. */
    pin: string | undefined
  }>({ data, list, index: activeRowIndex, pin: undefined })
  if (held.list !== list) {
    setHeld({
      data,
      list,
      index: activeRowIndex,
      pin: held.index === undefined ? undefined : held.list?.[held.index]?.id,
    })
  } else if (held.index !== activeRowIndex || held.data !== data) {
    setHeld({
      data,
      list,
      index: activeRowIndex,
      pin: held.index === activeRowIndex ? held.pin : undefined,
    })
  }
  const heldRowIndex =
    held.pin === undefined ? undefined : rows.indexOf(held.pin)

  const [band] = useState(createWindowBand)
  const previousBand = band.current()
  // После замены всего окна клиента запас рисуется при росте полосы. Иначе строки
  // вне экрана монтируются вместе с видимыми при обновлении данных и пересортировке.
  const replaceWindow = !!(
    list &&
    previousBand &&
    held.data !== data &&
    held.list !== list &&
    held.list?.length === list.length &&
    held.list[previousBand[0]]?.id !== list[previousBand[0]]?.id &&
    held.list[previousBand[1]]?.id !== list[previousBand[1]]?.id
  )
  const bandVersion = useBandRest(
    band,
    rows.keyByIndex ? rows.version?.() : list,
    isIncremental(table),
    replaceWindow,
  )
  const rangeExtractor = useRowRangeExtractor({
    band,
    bandVersion,
    rowDraggingIndex,
    activeRowIndex,
    heldRowIndex,
  })

  // Строки разной высоты (ADR 0218, §6): поправка прокрутки — только за строку целиком выше
  // экрана; строка у верхнего края стоит на месте, растёт вниз. Иначе — правило виртуализатора.
  const shouldAdjustOnSizeChange = useCallback(
    (
      item: VirtualItem,
      _delta: number,
      v: Virtualizer<HTMLDivElement, HTMLDivElement>,
    ) => {
      const top = v.scrollOffset ?? 0
      if (needs.size > 0 || estimate !== undefined) return item.end <= top
      return v.itemSizeCache.has(item.key)
        ? item.end <= top && v.scrollDirection !== 'backward'
        : item.start < top
    },
    [needs, estimate],
  )

  const latestTable = useLatest(table)
  const [windowFlush] = useState(() =>
    createWindowFlush(() => isIncremental(latestTable.current)),
  )
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.count(),
    estimateSize: getEstimateSize,
    getScrollElement,
    measureElement: rowMeasureElement,
    getItemKey,
    getFirstChangedIndex,
    shouldAdjustScrollPositionOnItemSizeChange: shouldAdjustOnSizeChange,
    overscan: ROWS_OVERSCAN,
    rangeExtractor,
    // Синхронно в событии — только непокрытый край (ADR 0202, §2).
    useFlushSync: windowFlush.flush,
    // Позиция — виртуальная, из слоя растяжки (ADR 0142).
    observeElementOffset: (instance, onOffset) =>
      instance.scrollElement
        ? scrollLayer(instance.scrollElement).subscribe(onOffset)
        : undefined,
    getElementMaxScrollOffset: instance => {
      const layer =
        instance.scrollElement && scrollLayer(instance.scrollElement)
      return layer?.stretched ? layer.maxTop() : undefined
    },
    scrollToFn: (offset, { adjustments = 0, behavior }, instance) => {
      if (!instance.scrollElement) return
      // Поправка на высоту строк выше экрана не обрывает щелчок колеса (ADR 0218, AH15).
      if (adjustments && !behavior) {
        scrollLayer(instance.scrollElement).adjustTo(offset + adjustments)
        return
      }
      scrollLayer(instance.scrollElement).scrollTo(
        { top: offset + adjustments },
        behavior === 'smooth' ? 'smooth' : 'instant',
      )
    },
  })

  // Первая строка экрана до смены списка (ADR 0218, §7): при строках разной высоты место
  // строки — не индекс × высота. Пишется на прокрутке и после каждого коммита.
  const anchorSeen = useRef<{ index: number; start: number } | undefined>(
    undefined,
  )
  const variable = () => needs.size > 0 || estimate !== undefined
  const anchorAt = (top: number) => {
    if (!variable()) return undefined
    const item = virtualizer.getVirtualItemForOffset(top)
    return item && { index: item.index, start: item.start }
  }
  /** Индекс первой строки экрана и смещение прокрутки от её начала. */
  const anchorOf = (top: number) => {
    const seen = anchorSeen.current
    const index = seen?.index ?? Math.floor(top / rowHeight)
    return { index, offset: top - (seen?.start ?? index * rowHeight) }
  }
  const startOf = (index: number) => {
    if (!variable()) return index * rowHeight
    // `getTotalSize` пересобирает места после `resizeItem` и `measure()`.
    virtualizer.getTotalSize()
    return virtualizer.measurementsCache[index]?.start ?? index * rowHeight
  }

  /** Высоты строк у окна — виртуализатору заново, после сброса его замеров. */
  const announceNear = () => {
    const { startIndex = 0, endIndex = -1 } = virtualizer.range ?? {}
    const count = rows.count()
    const last = Math.min(count - 1, endIndex + ANNOUNCE_SPAN)
    for (
      let index = Math.max(0, startIndex - ANNOUNCE_SPAN);
      index <= last;
      index++
    ) {
      const id = rows.at(index)?.id
      if (id === undefined || !needs.has(id)) continue
      virtualizer.resizeItem(index, rowSizeOf(needs, id, rowHeight, estimate))
    }
  }

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
    // Ключ строки — индекс: после вставок и удалений замеры по индексам — чужих строк. Сброс, и
    // строки у окна объявляют свои высоты заново (ADR 0218, §6).
    if (
      before &&
      before.version !== version &&
      rows.keyByIndex &&
      needs.size > 0 &&
      (before.epoch !== epoch ||
        rows.changesSince?.(before.version)?.some(batch => batch.length > 0))
    ) {
      virtualizer.measure()
      queueMicrotask(() => flushSync(() => announceNear()))
    }
    if (!before || before.epoch !== epoch || before.version === version) return
    const scroller = getScrollElement()
    const batches = rows.changesSince?.(before.version)
    if (!scroller || !batches) return
    const top = scrollLayer(scroller).top()
    if (top <= 0) return
    const anchor = anchorOf(top)
    const next = followIndex(anchor.index, batches)
    if (next !== anchor.index)
      scrollGridTo(scroller, { top: startOf(next) + anchor.offset }, 'instant')
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
    const anchor = anchorOf(top)
    for (let k = anchor.index; k < before.list.length; k++) {
      const at = rows.indexOf(before.list[k]!.id)
      if (at < 0) continue
      if (at !== k) {
        // При строках разной высоты: строка экрана ушла — следующая оставшаяся встаёт верхом.
        const next = variable()
          ? startOf(at) + (k === anchor.index ? anchor.offset : 0)
          : top + (at - k) * rowHeight
        scrollGridTo(scroller, { top: next }, 'instant')
      }
      return
    }
  })

  useIsomorphicLayoutEffect(() => {
    const scroller = getScrollElement()
    if (!scroller) return
    return scrollLayer(scroller).subscribe(top => {
      anchorSeen.current = anchorAt(top)
    })
  })
  useIsomorphicLayoutEffect(() => {
    // При равной высоте anchorOf считает место по индексу. Чтение scrollTop
    // после коммита здесь пересчитало бы стили и раскладку без пользы для якоря.
    const scroller = variable() ? getScrollElement() : null
    anchorSeen.current = scroller
      ? anchorAt(scrollLayer(scroller).top())
      : undefined
  })

  // Высоты содержимого строк (ADR 0218, §4): замер зовёт микрозадачей после коммита или
  // синхронно из своего наблюдателя — новая высота строки и места строк ниже в одной отрисовке
  // (AH17). `resizeItem` поправляет прокрутку на строки выше экрана (AH11).
  useIsomorphicLayoutEffect(
    () =>
      subscribeRowSizes(table, changed => {
        if (!changed) {
          virtualizer.measure()
          return
        }
        const sizes: [number, number][] = []
        for (const id of changed) {
          const index = rows.indexOf(id)
          if (index >= 0)
            sizes.push([index, rowSizeOf(needs, id, rowHeight, estimate)])
        }
        // Одной пачкой: одно оповещение и одна пересборка мест.
        virtualizer.resizeItems(sizes)
      }),
    [table, virtualizer, rows, needs, rowHeight, estimate],
  )

  // Новая высота: замеры строк прежней высоты больше не верны. Прокрутка держит первую строку
  // экрана (ADR 0077, RH10): её место — по прежней высоте, смещение в строке — в долях строки.
  const measuredHeight = useRef(rowHeight)
  useIsomorphicLayoutEffect(() => {
    const previous = measuredHeight.current
    if (previous === rowHeight) return
    measuredHeight.current = rowHeight
    const scroller = getScrollElement()
    const top = scroller ? scrollLayer(scroller).top() : 0
    const seen = anchorSeen.current
    const index = seen?.index ?? Math.floor(top / previous)
    const rest = top - (seen?.start ?? index * previous)
    virtualizer.measure()
    if (!scroller || top <= 0) return
    scrollGridTo(
      scroller,
      { top: startOf(index) + (rest * rowHeight) / previous },
      'instant',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- место строки читается на смену высоты
  }, [rowHeight, virtualizer])

  // Строки на экране — от фактической прокрутки: в растянутой области их виртуальное
  // начало минус база сдвига слоя, остаток слой ставит сам. Строки далеко за экраном
  // (активная, перетаскиваемая) — не дальше нескольких экранов: место за пределом
  // браузера он обрезает или обнуляет.
  const items = virtualizer.getVirtualItems()
  useIsomorphicLayoutEffect(() => {
    windowFlush.show(items.map(item => item.index))
  })
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
  let virtualRows = items
  if (scroller && layer?.stretched) {
    const near = layer.top() - base
    const reach = scroller.clientHeight * FAR_SCREENS
    virtualRows = items.map(item => {
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
  }
  // Новые строки получают остаток сдвига до кадра.
  useIsomorphicLayoutEffect(() => {
    layer?.commitBase(base)
  })

  return {
    virtualRows,
    bodyHeight: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
    virtualizer,
    band,
  }
}
