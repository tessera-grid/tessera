/**
 * Ячейка и строка тела, которых коснулись пальцем последними (ADR 0086, §2): признак
 * `data-touched` показывает их скрытые кнопки без наведения. Ставится в DOM напрямую —
 * касание не перерисовывает грид; ячейка, ушедшая из окна виртуализации, его теряет.
 */
const CELL = '.data-grid__body-cell'
const ROW = '.data-grid__body-row'

export const trackTouchedCell = (getScroller: () => HTMLElement | null) => {
  let touched: Element[] = []
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    const scroller = getScroller()
    const target = event.target as Element | null
    if (!scroller || !target || !scroller.contains(target)) return
    const next = [target.closest(CELL), target.closest(ROW)].filter(
      (el): el is Element => !!el,
    )
    for (const el of touched) {
      if (!next.includes(el)) el.removeAttribute('data-touched')
    }
    for (const el of next) el.setAttribute('data-touched', '')
    touched = next
  }
  window.addEventListener('pointerdown', onPointerDown, true)
  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    for (const el of touched) el.removeAttribute('data-touched')
  }
}
