// Закреплённые колонки прилипли — под ними прокручено содержимое: на контейнере стоят
// `data-pinned-left-stuck` и `data-pinned-right-stuck`, по ним блок получает тон и линию.
import { useEffect } from 'react'

/** Монтируется, когда в таблице есть закреплённые колонки. */
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
    let left = 0
    let right = 0
    const showEdges = () => {
      root.toggleAttribute('data-pinned-left-stuck', left > 0)
      root.toggleAttribute('data-pinned-right-stuck', left < right)
    }
    const onScroll = () => {
      const next = root.scrollLeft
      if (next === left) return
      left = next
      showEdges()
    }
    const measure = () => {
      left = root.scrollLeft
      // При дробном масштабе до правого края не хватает доли пикселя.
      right = root.scrollWidth - root.clientWidth - 1
      showEdges()
    }
    measure()
    root.addEventListener('scroll', onScroll, { passive: true })
    const resize = new ResizeObserver(measure)
    resize.observe(root)
    // Шапка шириной в колонки: её размер меняет смена ширин без прокрутки.
    const head = root.querySelector('.data-grid__head')
    if (head) resize.observe(head)
    return () => {
      root.removeEventListener('scroll', onScroll)
      resize.disconnect()
      root.removeAttribute('data-pinned-left-stuck')
      root.removeAttribute('data-pinned-right-stuck')
    }
  }, [getScrollElement])
  return null
}
