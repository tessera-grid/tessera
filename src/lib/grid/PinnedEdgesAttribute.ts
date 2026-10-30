// Закреплённые колонки прилипли — под ними прокручено содержимое: на контейнере стоят
// `data-pinned-left-stuck` и `data-pinned-right-stuck`, по ним блок получает тон и линию.
import { useEffect } from 'react'

const update = (root: HTMLElement) => {
  const left = root.scrollLeft
  root.toggleAttribute('data-pinned-left-stuck', left > 0)
  // Дробная прокрутка при масштабе страницы не доходит до края на долю пикселя.
  root.toggleAttribute(
    'data-pinned-right-stuck',
    left < root.scrollWidth - root.clientWidth - 1,
  )
}

/** Монтируется в основной ветке грида: в ветке заглушки контейнера прокрутки нет. */
export const PinnedEdgesAttribute = ({
  getScrollElement,
  columnSizes,
}: {
  getScrollElement: () => HTMLElement | null
  /** Ширины колонок: их смена меняет ширину таблицы без прокрутки. */
  columnSizes: unknown
}) => {
  useEffect(() => {
    const root = getScrollElement()
    if (!root) {
      return
    }
    const onChange = () => update(root)
    root.addEventListener('scroll', onChange, { passive: true })
    const resize = new ResizeObserver(onChange)
    resize.observe(root)
    return () => {
      root.removeEventListener('scroll', onChange)
      resize.disconnect()
      root.removeAttribute('data-pinned-left-stuck')
      root.removeAttribute('data-pinned-right-stuck')
    }
  }, [getScrollElement])

  useEffect(() => {
    const root = getScrollElement()
    if (root) update(root)
  }, [getScrollElement, columnSizes])
  return null
}
