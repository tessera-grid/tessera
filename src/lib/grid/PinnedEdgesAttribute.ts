// Закреплённые колонки прилипли — под ними прокручено содержимое: на контейнере стоят
// `data-pinned-left-stuck` и `data-pinned-right-stuck`, по ним блок получает тон и линию.
import { useEffect } from 'react'

/** Монтируется в основной ветке грида: в ветке заглушки контейнера прокрутки нет. */
export const PinnedEdgesAttribute = ({
  getScrollElement,
}: {
  getScrollElement: () => HTMLElement | null
}) => {
  useEffect(() => {
    const root = getScrollElement()
    if (!root) {
      return
    }
    const update = () => {
      const left = root.scrollLeft
      root.toggleAttribute('data-pinned-left-stuck', left > 0)
      // Дробная прокрутка при масштабе страницы не доходит до края на долю пикселя.
      root.toggleAttribute(
        'data-pinned-right-stuck',
        left < root.scrollWidth - root.clientWidth - 1,
      )
    }
    root.addEventListener('scroll', update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(root)
    // Шапка шириной в колонки: её размер меняет смена ширин без прокрутки.
    const head = root.querySelector('.data-grid__head')
    if (head) resize.observe(head)
    return () => {
      root.removeEventListener('scroll', update)
      resize.disconnect()
      root.removeAttribute('data-pinned-left-stuck')
      root.removeAttribute('data-pinned-right-stuck')
    }
  }, [getScrollElement])
  return null
}
