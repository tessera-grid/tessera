/**
 * Автопрокрутка у края во время протяжки ширины (ADR 0197, §5): указатель у правого края
 * видимой области прокручивает таблицу вправо, у левого — влево, а граница колонки остаётся
 * под указателем.
 *
 * TanStack считает ширину по смещению указателя от точки нажатия (`startOffset` среза
 * `columnResizing`). Прокрутка сдвигает колонку под неподвижным указателем, поэтому точка
 * нажатия сдвигается на прокрученное, а движение указателя в прежней точке повторяется —
 * ширина пересчитывается тем же путём, что от настоящего движения.
 *
 * Сужение у конца прокрутки поджимает таблицу, как обычно: граница остаётся у края, а
 * колонки левее сдвигаются вправо. Когда указатель снова у края, а граница впереди него,
 * таблица сперва докручивается к ней со скоростью края и лишь затем колонка растёт.
 */
import { type RefObject, useEffect } from 'react'

import { scrollLayer } from '../../core/scrollStretch'
import { EDGE_ZONE, edgeSpeed } from '../../shared/edgeScroll'
import { useLatest } from '../../util/useLatest'

interface ResizingState {
  startOffset?: number | null
  startSize?: number | null
}

interface ResizingTable {
  atoms?: { columnResizing?: { get: () => ResizingState | undefined } }
  setColumnResizing?: (updater: (old: ResizingState) => object) => void
}

export interface ResizeLimits {
  table: unknown
  minSize: number
  /** `undefined` — без верхней границы. */
  maxSize?: number
}

interface Pointer {
  x: number
  y: number
  touch?: TouchEvent
}

/** Движение указателя в той же точке: TanStack пересчитывает ширину от сдвинутой точки нажатия. */
const repeatMove = ({ x, y, touch }: Pointer) => {
  if (!touch) {
    document.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }),
    )
    return
  }
  // TanStack читает touches[0].clientX. Используем последнее реальное касание,
  // так как WebKit не позволяет создать Touch из JavaScript.
  document.dispatchEvent(
    Object.assign(new Event('touchmove', { bubbles: true, cancelable: true }), {
      touches: touch.touches,
      changedTouches: touch.changedTouches,
      targetTouches: touch.targetTouches,
    }),
  )
}

/** Меньший зазор границы впереди указателя докрутка не трогает (px). */
const CATCH_UP_MIN = 1.5

export const useResizeAutoScroll = (
  wrapperRef: RefObject<HTMLElement | null>,
  active: boolean,
  limits: ResizeLimits,
) => {
  const latest = useLatest(limits)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!active || !wrapper) return
    const cell = wrapper.closest('.data-grid__head-cell')
    const scroller = wrapper.closest<HTMLElement>('.data-grid__container')
    // Закреплённая колонка не едет при прокрутке: прокрутка ширину не меняла бы.
    const pinned = cell?.getAttribute('data-cell-pinned')
    if (!scroller || pinned === 'left' || pinned === 'right') return

    let pointer: Pointer | null = null
    const onMouse = (event: MouseEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
    }
    const onTouch = (event: TouchEvent) => {
      const finger = event.touches[0]
      if (finger) {
        pointer = { x: finger.clientX, y: finger.clientY, touch: event }
      }
    }

    /** Сдвинуть точку нажатия: ширина колонки меняется на `delta` от прежней. */
    const shift = (delta: number) =>
      (latest.current.table as ResizingTable).setColumnResizing?.(old => ({
        ...old,
        startOffset: (old.startOffset ?? 0) - delta,
      }))
    /**
     * Вправо колонка растёт на шаг, а таблица докручивается на него после раскладки кадра
     * (наблюдатель размера заголовка): у конца прокрутки места справа нет, пока колонка не
     * вырастет, — прокрутка до роста упёрлась бы в край.
     */
    let pending = 0
    /** Кадры, которые шаг ждёт раскладки. */
    let waited = 0
    /** Насколько граница осталась впереди указателя: таблица уже области, прокручивать некуда. */
    let ahead = 0
    /** Докрутка после раскладки уже была в этом кадре: следующий кадр края не докручивает. */
    let scrolledAfterLayout = false
    /**
     * Ширина колонки по срезу и указателю, в пределах колонки: отрисованная отстаёт на
     * перерисовку, и на React 18 — больше чем на кадр.
     */
    const widthBy = (at: Pointer) => {
      const { table, minSize, maxSize } = latest.current
      const info = (table as ResizingTable).atoms?.columnResizing?.get()
      const size = (info?.startSize ?? 0) + at.x - (info?.startOffset ?? at.x)
      return Math.min(
        Math.max(size, minSize),
        maxSize ?? Number.POSITIVE_INFINITY,
      )
    }
    /** Насколько граница впереди указателя: левый край — из раскладки, он едет с прокруткой. */
    const gapBy = (at: Pointer, box: Element) =>
      box.getBoundingClientRect().left + widthBy(at) - at.x
    /**
     * После раскладки: граница впереди указателя на столько, на сколько докрутить. Колонка
     * ещё не доросла до ширины среза — шаг ждёт: иначе следующий шаг вырастил бы её ещё раз.
     */
    const onGrown = (forced = false) => {
      if (pending === 0 || !pointer || !cell) return
      if (
        !forced &&
        cell.getBoundingClientRect().width < widthBy(pointer) - 0.5
      )
        return
      // Не дальше шага: остаток зазора докрутит край в следующих кадрах — без скачка.
      const step = pending
      pending = 0
      waited = 0
      const gap = gapBy(pointer, cell)
      if (gap < 0.5) {
        ahead = 0
        return
      }
      const before = scroller.scrollLeft
      scrollLayer(scroller).scrollBy(0, Math.min(gap, step))
      ahead = gap - (scroller.scrollLeft - before)
      scrolledAfterLayout = true
    }
    /** Указатель ушёл из краевой зоны: граница возвращается под него. */
    const settle = () => {
      if (ahead < 0.5 || !pointer) return
      shift(-ahead)
      ahead = 0
      repeatMove(pointer)
    }

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!pointer) return
      const { table, minSize, maxSize } = latest.current
      const info = (table as ResizingTable).atoms?.columnResizing?.get()
      // Ширина по указателю без пределов колонки — из среза, а не из отрисованной: та
      // отстаёт на перерисовку.
      const size =
        (info?.startSize ?? 0) + pointer.x - (info?.startOffset ?? pointer.x)
      const area = scroller.getBoundingClientRect()
      const left = area.left + scroller.clientLeft
      const right = left + scroller.clientWidth
      if (pointer.x > right - EDGE_ZONE) {
        const room = (maxSize ?? Number.POSITIVE_INFINITY) - size
        const dx = Math.min(edgeSpeed(pointer.x - (right - EDGE_ZONE)), room)
        // Шаг ждёт раскладки; наблюдатель запоздал — прокрутка применяется сама.
        if (pending > 0) {
          if (++waited > 3) onGrown(true)
          return
        }
        // Одна прокрутка между кадрами: докрутку после роста кадр края не дополняет.
        if (scrolledAfterLayout) {
          scrolledAfterLayout = false
          return
        }
        // Граница впереди указателя: сперва докрутить к ней, ширину не меняя.
        const gap = cell ? gapBy(pointer, cell) : 0
        // Зазор в толщину черты и дробные пиксели (WebKit) — не повод крутить таблицу.
        if (gap > CATCH_UP_MIN) {
          const before = scroller.scrollLeft
          scrollLayer(scroller).scrollBy(
            0,
            Math.min(gap, edgeSpeed(pointer.x - (right - EDGE_ZONE))),
          )
          const moved = scroller.scrollLeft - before
          ahead = Math.max(0, ahead - moved)
          if (moved !== 0) return
        }
        if (dx < 0.5) return
        pending = dx
        shift(dx)
        repeatMove(pointer)
        return
      }
      if (pointer.x < left + EDGE_ZONE) {
        const room = size - minSize
        const dx = Math.min(edgeSpeed(left + EDGE_ZONE - pointer.x), room)
        if (dx < 0.5) return
        // Влево прокрутке место есть до начала таблицы: сначала прокрутка, затем ширина.
        const before = scroller.scrollLeft
        scrollLayer(scroller).scrollBy(0, -dx)
        const moved = scroller.scrollLeft - before
        if (moved === 0) return
        shift(moved)
        repeatMove(pointer)
        return
      }
      settle()
    }

    const grown = new ResizeObserver(() => onGrown())
    if (cell) grown.observe(cell)

    document.addEventListener('mousemove', onMouse, true)
    document.addEventListener('touchmove', onTouch, true)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      grown.disconnect()
      document.removeEventListener('mousemove', onMouse, true)
      document.removeEventListener('touchmove', onTouch, true)
    }
  }, [active, wrapperRef, latest])
}
