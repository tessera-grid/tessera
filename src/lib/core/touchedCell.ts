/**
 * Ячейка и строка тела, которых коснулись пальцем последними (ADR 0086, §2): признак
 * `data-touched` показывает их скрытые кнопки без наведения. Ставится в DOM напрямую —
 * касание не перерисовывает грид; ячейка, ушедшая из окна виртуализации, его теряет.
 * Перетаскивание и нажатие мимо таблицы снимают признак, не трогая выделение.
 */
const CELL = '.data-grid__body-cell'
const ROW = '.data-grid__body-row'

export const trackTouchedCell = (getScroller: () => HTMLElement | null) => {
  let touched: Element[] = []
  const clear = () => {
    for (const el of touched) el.removeAttribute('data-touched')
    touched = []
  }
  const onPointerDown = (event: PointerEvent) => {
    const scroller = getScroller()
    const target = event.target as Element | null
    if (!scroller || !target || !scroller.contains(target)) {
      clear()
      return
    }
    if (event.pointerType !== 'touch') return
    const next = [target.closest(CELL), target.closest(ROW)].filter(
      (el): el is Element => !!el,
    )
    for (const el of touched) {
      if (!next.includes(el)) el.removeAttribute('data-touched')
    }
    for (const el of next) el.setAttribute('data-touched', '')
    touched = next
  }
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    const scroller = getScroller()
    if (
      scroller?.hasAttribute('data-row-dragging') ||
      scroller?.hasAttribute('data-column-dragging')
    ) {
      clear()
    }
  }
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointermove', onPointerMove, true)
  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('pointermove', onPointerMove, true)
    clear()
  }
}
