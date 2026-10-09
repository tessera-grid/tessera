// Пока грид прокручивается, на контейнере стоит `data-scrolling` (ADR 0076, RW3): под
// неподвижным курсором ячейки меняются каждый кадр, и плавное раскрытие их кнопок
// пересчитывало бы раскладку прямо во время прокрутки.
import { useEffect } from 'react'

/** Сколько ждать тишины после последнего события прокрутки, мс. */
const SCROLL_IDLE_MS = 150

/** Монтируется в основной ветке грида: в ветке заглушки контейнера прокрутки нет. */
export const ScrollingAttribute = ({
  getScrollElement,
}: {
  getScrollElement: () => HTMLElement | null
}) => {
  useEffect(() => {
    const root = getScrollElement()
    if (!root) {
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      if (timer === undefined) {
        root.setAttribute('data-scrolling', '')
      }
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        root.removeAttribute('data-scrolling')
      }, SCROLL_IDLE_MS)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      root.removeEventListener('scroll', onScroll)
      root.removeAttribute('data-scrolling')
    }
  }, [getScrollElement])
  return null
}
