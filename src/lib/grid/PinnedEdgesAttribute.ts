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
    const head = root.querySelector('.data-grid__head')
    let left = 0
    let right = 0
    let gutter = 0
    const showEdges = () => {
      let rightStuck = left < right
      // Chromium может вычесть пустой gutter из clientWidth, но не из области прокрутки.
      // У самого края проверяем фактический сдвиг закреплённой ячейки относительно шапки.
      if (rightStuck && head && left >= right - gutter) {
        const last = head.querySelector(
          '[data-last-header-in-row="true"][data-cell-pinned="right"]',
        )
        if (last) {
          rightStuck =
            head.getBoundingClientRect().right -
              last.getBoundingClientRect().right >
            1
        }
      }
      root.toggleAttribute('data-pinned-left-stuck', left > 0)
      root.toggleAttribute('data-pinned-right-stuck', rightStuck)
    }
    const onScroll = () => {
      const next = root.scrollLeft
      if (next === left) return
      left = next
      showEdges()
    }
    const measure = () => {
      left = root.scrollLeft
      const width = root.clientWidth
      gutter = root.offsetWidth - width
      // При дробном масштабе до правого края не хватает доли пикселя.
      right = root.scrollWidth - width - 1
      showEdges()
    }
    measure()
    root.addEventListener('scroll', onScroll, { passive: true })
    const resize = new ResizeObserver(measure)
    resize.observe(root)
    // Шапка шириной в колонки: её размер меняет смена ширин без прокрутки.
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
