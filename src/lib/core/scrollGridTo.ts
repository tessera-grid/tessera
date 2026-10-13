/**
 * Прокрутка грида к цели (ADR 0105): помечена программной — быструю прокрутку не
 * включает (FS8). Плавно — дальше экрана мгновенный прыжок на экран от цели, затем
 * плавно последний экран: движение видно, а рисуется только последний экран. С
 * `prefers-reduced-motion: reduce` — мгновенно.
 */
import { markProgrammaticScroll } from './fastScroll/fastScrollDetector'
import { getBodyViewport } from './keyboardNavigation/geometry'

export interface ScrollTarget {
  top?: number
  left?: number
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

/** Экран по осям: высота окна тела между липкими шапкой и футером и ширина области. */
const screenOf = (scroller: HTMLElement) => {
  const { top, bottom } = getBodyViewport(scroller)
  return { height: Math.max(bottom - top, 1), width: scroller.clientWidth }
}

export const scrollGridTo = (
  scroller: HTMLElement,
  target: ScrollTarget,
  behavior: 'instant' | 'smooth',
) => {
  markProgrammaticScroll(scroller)
  if (behavior === 'instant' || prefersReducedMotion()) {
    scroller.scrollTo({ ...target, behavior: 'instant' })
    return
  }
  const screen = screenOf(scroller)
  const near: ScrollTarget = {}
  if (target.top !== undefined) {
    const distance = target.top - scroller.scrollTop
    if (Math.abs(distance) > screen.height) {
      near.top = target.top - Math.sign(distance) * screen.height
    }
  }
  if (target.left !== undefined) {
    const distance = target.left - scroller.scrollLeft
    if (Math.abs(distance) > screen.width) {
      near.left = target.left - Math.sign(distance) * screen.width
    }
  }
  if (near.top !== undefined || near.left !== undefined) {
    scroller.scrollTo({ ...near, behavior: 'instant' })
  }
  scroller.scrollTo({ ...target, behavior: 'smooth' })
}
