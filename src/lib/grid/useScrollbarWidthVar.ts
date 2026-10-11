import { type RefObject } from 'react'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'

export const SCROLLBAR_WIDTH_VAR = '--tsr-comp-scrollbar-actual-width'

/**
 * Измеряет реальную ширину вертикального скроллбара скролл-контейнера и кладёт её
 * в CSS-переменную на targetRef — чтобы линейный прогресс (ширина = 100% -
 * scrollbar) совпадал с краем контента в любом браузере. Overlay-скроллы дают 0 →
 * бар на всю ширину.
 *
 * Реализация имперная (setProperty) → не вызывает ре-рендер грида. Пересчёт только
 * по ResizeObserver; запись меняет ширину лишь у лоадера (position: absolute), так что
 * обратной связи с observer нет. Первый замер намеренно НЕ синхронный: observe()
 * присылает начальный колбэк уже после раскладки, а до него CSS падает на
 * фолбэк-токен — синхронный замер мог бы записать 0 до появления скроллбара.
 */
export const useScrollbarWidthVar = (
  getScrollElement: () => HTMLElement | null,
  targetRef: RefObject<HTMLElement | null>,
  enabled = true,
) => {
  useIsomorphicLayoutEffect(() => {
    const element = getScrollElement()
    const target = targetRef.current

    if (!enabled || !element || !target) {
      return
    }

    let previous = -1

    const observer = new ResizeObserver(() => {
      const width = element.offsetWidth - element.clientWidth

      if (width === previous) {
        return
      }

      previous = width
      target.style.setProperty(SCROLLBAR_WIDTH_VAR, `${width}px`)
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [getScrollElement, targetRef, enabled])
}
