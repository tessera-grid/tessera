import { useEffect, useRef } from 'react'

import type { FastScrollStore } from './fastScroll/useFastScroll'
import { useTableState } from './reactivity'
import { scrollGridTo } from './scrollGridTo'
import type { RowSource } from './rowSource'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import { useLatest } from './useLatest'

interface RowRange {
  range: { startIndex: number; endIndex: number } | null
  options: { overscan: number }
  scrollElement: Element | Window | null
}

const sameConditions = (a: readonly unknown[], b: readonly unknown[]) =>
  a.every((value, index) => value === b[index])

/**
 * Окно строк тела и быстрая прокрутка — источнику с `observe` (ADR 0138, §4). Окно —
 * видимые строки с запасом виртуализатора, без закреплённых далёких строк (активной,
 * перетаскиваемой): иначе оно растянулось бы на весь список. Смена сортировки, фильтров,
 * поиска или группировки (ADR 0144) начинает список заново — тело в начале (§6).
 */
export const useRowSourceWindow = (
  table: unknown,
  source: RowSource,
  virtualizer: RowRange,
  fastScroll: FastScrollStore,
) => {
  const overscan = virtualizer.options.overscan
  const first = Math.max((virtualizer.range?.startIndex ?? 0) - overscan, 0)
  const last = (virtualizer.range?.endIndex ?? -1) + overscan
  const window = useLatest({ first, last })

  const conditions = useTableState(table as never, s => [
    s.sorting,
    s.columnFilters,
    s.globalFilter,
    (s as { grouping?: unknown }).grouping,
  ]) as readonly unknown[]
  const previousConditions = useRef(conditions)
  useIsomorphicLayoutEffect(() => {
    if (!source.sync) return
    if (sameConditions(previousConditions.current, conditions)) return
    previousConditions.current = conditions
    source.sync()
    // Прокрутка грида, а не жест: быструю прокрутку не включает (FS8).
    const scroller = virtualizer.scrollElement
    if (scroller instanceof HTMLElement) {
      scrollGridTo(scroller, { top: 0 }, 'instant')
    }
  }, [source, conditions, virtualizer])

  // Окно — в индексах страницы: другая страница — другие строки при том же окне (ADR 0158).
  const page = useTableState(table as never, s => s.pagination)
  useIsomorphicLayoutEffect(() => {
    source.observe?.({
      first,
      last,
      fast: fastScroll.getSnapshot().isFastScrolling,
    })
  }, [source, first, last, fastScroll, page])

  useEffect(() => {
    if (!source.observe) return
    let fast = fastScroll.getSnapshot().isFastScrolling
    return fastScroll.subscribe(() => {
      const next = fastScroll.getSnapshot().isFastScrolling
      if (next === fast) return
      fast = next
      source.observe?.({ ...window.current, fast })
    })
  }, [source, fastScroll, window])
}
