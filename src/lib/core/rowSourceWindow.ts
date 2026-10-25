import { useEffect } from 'react'

import type { FastScrollStore } from './fastScroll/useFastScroll'
import type { RowSource } from './rowSource'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import { useLatest } from './useLatest'

interface RowRange {
  range: { startIndex: number; endIndex: number } | null
  options: { overscan: number }
}

/**
 * Окно строк тела и быстрая прокрутка — источнику с `observe` (ADR 0138, §4). Окно —
 * видимые строки с запасом виртуализатора, без закреплённых далёких строк (активной,
 * перетаскиваемой): иначе оно растянулось бы на весь список.
 */
export const useRowSourceWindow = (
  source: RowSource,
  virtualizer: RowRange,
  fastScroll: FastScrollStore,
) => {
  const overscan = virtualizer.options.overscan
  const first = Math.max((virtualizer.range?.startIndex ?? 0) - overscan, 0)
  const last = (virtualizer.range?.endIndex ?? -1) + overscan
  const window = useLatest({ first, last })

  useIsomorphicLayoutEffect(() => {
    source.observe?.({
      first,
      last,
      fast: fastScroll.getSnapshot().isFastScrolling,
    })
  }, [source, first, last, fastScroll])

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
