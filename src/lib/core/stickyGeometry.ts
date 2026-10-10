/**
 * Геометрия закреплённых ячеек (`position: sticky`) перед нажатием над гридом (ADR 0085,
 * MM3). Firefox пересчитывает их положение на главном потоке только при прокрутке:
 * после перекладки внутри ячейки `getBoundingClientRect()` и попадание указателя видят
 * её на незакреплённом месте, хотя рисует её компоновщик верно. Меню Base UI сверяет
 * отпускание кнопки с прямоугольником триггера и закрылось бы. Сдвиг прокрутки на
 * пиксель туда и обратно пересчитывает положение сразу; на экране ничего не меняется.
 */
const syncStickyGeometry = (scroller: HTMLElement) => {
  const horizontal = scroller.scrollWidth > scroller.clientWidth
  const axis = horizontal ? 'scrollLeft' : 'scrollTop'
  const max = horizontal
    ? scroller.scrollWidth - scroller.clientWidth
    : scroller.scrollHeight - scroller.clientHeight
  if (max <= 0) return
  const at = scroller[axis]
  scroller[axis] = at < max ? at + 1 : at - 1
  scroller[axis] = at
}

/** Синхронизировать перед нажатием, отпусканием и клавишей открытия над гридом. */
export const trackStickyGeometry = (getScroller: () => HTMLElement | null) => {
  const onPress = (event: Event) => {
    const scroller = getScroller()
    if (!scroller?.contains(event.target as Node)) return
    if (
      event instanceof KeyboardEvent &&
      event.key !== 'Enter' &&
      event.key !== ' '
    ) {
      return
    }
    syncStickyGeometry(scroller)
  }
  const types = ['pointerdown', 'pointerup', 'keydown'] as const
  for (const type of types) window.addEventListener(type, onPress, true)
  return () => {
    for (const type of types) window.removeEventListener(type, onPress, true)
  }
}
