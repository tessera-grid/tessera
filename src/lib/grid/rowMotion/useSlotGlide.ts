import { type RefObject, useLayoutEffect, useRef } from 'react'

import { rowMotionTiming } from './rowMotionTiming'

/**
 * Слот перетаскивания при прокрутке грида (ADR 0107, RM24): цель меняется каждые
 * несколько кадров, и слот доезжает до неё Web Animations из текущего видимого
 * положения. CSS-переход `transform` не годится: Firefox перезапускает его не с видимой
 * точки, и слот проваливается на несколько строк. Анимируется сам `transform` — dnd-kit
 * вычитает его при замерах строк, а отдельный `translate` сбил бы ему цель.
 */
export const useSlotGlide = (
  node: RefObject<HTMLElement | null>,
  y: number,
  active: boolean,
  transformAt: (y: number) => string,
) => {
  const prevY = useRef(y)
  const glide = useRef<Animation | null>(null)
  const timing = useRef<{ duration: number; easing: string } | null>(null)

  useLayoutEffect(() => {
    const from = prevY.current
    prevY.current = y
    const element = node.current
    if (!active || !element) {
      glide.current?.cancel()
      glide.current = null
      timing.current = null
      return
    }
    const container = element.closest('.data-grid__container')
    if (
      from === y ||
      !container?.matches(
        '[data-row-animation][data-scrolling]:not([data-fast-scrolling])',
      )
    ) {
      return
    }
    timing.current ??= rowMotionTiming(element)
    const duration = timing.current.duration / 3
    if (!duration) return
    const shown =
      glide.current?.playState === 'running'
        ? new DOMMatrix(getComputedStyle(element).transform).m42
        : from
    glide.current?.cancel()
    // Конец — явным ключом: так текущий кадр читается верно и после смены цели.
    glide.current = element.animate(
      [{ transform: transformAt(shown) }, { transform: transformAt(y) }],
      { duration, easing: timing.current.easing },
    )
  }, [node, y, active, transformAt])
}
