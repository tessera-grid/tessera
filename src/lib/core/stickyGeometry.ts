/**
 * Геометрия закреплённых ячеек (`position: sticky`) перед нажатием над гридом (ADR 0085,
 * MM3). Firefox пересчитывает их положение на главном потоке только при прокрутке:
 * после перекладки внутри ячейки `getBoundingClientRect()` и попадание указателя видят
 * её на незакреплённом месте, хотя рисует её компоновщик верно. Меню Base UI сверяет
 * отпускание кнопки с прямоугольником триггера и закрылось бы. Сдвиг прокрутки на
 * пиксель туда и обратно пересчитывает положение сразу; на экране ничего не меняется.
 */
export const syncStickyGeometry = (scroller: HTMLElement) => {
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

/**
 * Ошибка — только у Firefox (Gecko): в WebKit сдвиг шлёт события прокрутки и будит грид
 * на каждое нажатие (ADR 0196, HR5), в Chromium он лишний.
 */
const needsSync = () =>
  typeof CSS !== 'undefined' && CSS.supports('-moz-appearance', 'none')

/** Синхронизировать перед нажатием, отпусканием и клавишей открытия над гридом. */
export const trackStickyGeometry = (getScroller: () => HTMLElement | null) => {
  if (!needsSync()) return () => {}
  const onPress = (event: Event) => {
    const scroller = getScroller()
    const target = event.target
    if (!scroller || !(target instanceof Node) || !scroller.contains(target))
      return
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
