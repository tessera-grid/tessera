/**
 * Прокрутка грида к цели (ADR 0105): помечена программной — быструю прокрутку не
 * включает (FS8). Плавно — дальше экрана мгновенный прыжок на экран от цели, затем
 * плавно последний экран: движение видно, а рисуется только последний экран. С
 * `prefers-reduced-motion: reduce` — мгновенно. По вертикали — виртуальные координаты
 * слоя растяжки (ADR 0142).
 */
import { markProgrammaticScroll } from './fastScroll/fastScrollDetector'
import { getBodyViewport } from './keyboardNavigation/geometry'
import {
  prefersReducedMotion,
  scrollLayer,
  type ScrollTarget,
} from './scrollStretch'

export { prefersReducedMotion, type ScrollTarget }

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
  const layer = scrollLayer(scroller)
  if (behavior === 'instant' || prefersReducedMotion()) {
    layer.scrollTo(target, 'instant')
    return
  }
  const screen = screenOf(scroller)
  const near: ScrollTarget = {}
  if (target.top !== undefined) {
    const distance = target.top - layer.top()
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
    layer.scrollTo(near, 'instant')
  }
  layer.scrollTo(target, 'smooth')
}
