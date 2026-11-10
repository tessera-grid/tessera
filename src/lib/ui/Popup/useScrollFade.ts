import { type Ref, useCallback, useRef } from 'react'

import { assignRef } from '../assignRef'

/**
 * Затемнение краёв прокручиваемой области поповера (ADR 0183, PK31): callback-ref ставит
 * `data-fade-top`/`data-fade-bottom`, пока за краем есть содержимое, и ширину полосы прокрутки —
 * маска класса `scrollFade` её не гасит. Узел передаёт и в `ref`, если он есть.
 */
export const useScrollFade = <E extends HTMLElement>(ref?: Ref<E>) => {
  const detach = useRef<(() => void) | null>(null)
  return useCallback(
    (element: E | null) => {
      assignRef(ref, element)
      detach.current?.()
      detach.current = null
      if (!element) return
      let scrollbar = -1
      const update = () => {
        const { scrollTop, scrollHeight, clientHeight } = element
        const below = Math.max(0, scrollHeight - clientHeight - scrollTop)
        element.toggleAttribute('data-fade-top', scrollTop > 0.5)
        element.toggleAttribute('data-fade-bottom', below > 0.5)
        // Затемнение растёт с прокруткой от края до полной высоты — без скачка на первом пикселе.
        element.style.setProperty('--tsr-scroll-fade-above', `${scrollTop}px`)
        element.style.setProperty('--tsr-scroll-fade-below', `${below}px`)
        const width = element.offsetWidth - element.clientWidth
        if (width === scrollbar) return
        scrollbar = width
        element.style.setProperty('--tsr-scroll-fade-scrollbar', `${width}px`)
      }
      const resize = new ResizeObserver(update)
      const observeChildren = () => {
        for (const child of element.children) resize.observe(child)
      }
      // Новые записи и смена содержимого меняют высоту прокрутки без смены размера области.
      const mutation = new MutationObserver(() => {
        observeChildren()
        update()
      })
      resize.observe(element)
      observeChildren()
      mutation.observe(element, { childList: true })
      element.addEventListener('scroll', update, { passive: true })
      update()
      detach.current = () => {
        element.removeEventListener('scroll', update)
        resize.disconnect()
        mutation.disconnect()
      }
    },
    [ref],
  )
}
