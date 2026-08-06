import { RefObject, useLayoutEffect } from 'react'

export const SCROLLBAR_WIDTH_VAR = '--data-grid-scrollbar-actual-width'

/**
 * Измеряет реальную ширину вертикального скроллбара скролл-контейнера и кладёт
 * её в CSS-переменную на `targetRef`. Нужно, чтобы линейный прогресс
 * (ширина = `100% - scrollbar`) точно совпадал с краем контента в любом
 * браузере и при любом переопределении скролла потребителем — без завязки на
 * фиксированный токен-догадку. Overlay-скроллы дают 0 → бар на всю ширину.
 *
 * Реализация имперная (`setProperty`), поэтому НЕ вызывает ре-рендер грида.
 * Пересчёт идёт только по `ResizeObserver` (появление/исчезновение скролла,
 * ресайз контейнера) — не на скролле и не в hot-path виртуализации. Запись
 * меняет ширину только у лоадера (он `position: absolute`), контейнер не
 * ресайзит → обратной связи с observer нет.
 *
 * Первый замер намеренно НЕ синхронный: `observe()` сам присылает начальный
 * колбэк уже после раскладки (когда скроллбар посчитан), а до него переменная
 * не задана и CSS падает на фолбэк-токен. Синхронный замер в useLayoutEffect
 * мог бы поймать состояние до появления скролла и записать 0, погасив фолбэк.
 */
export const useScrollbarWidthVar = (
  getScrollElement: () => HTMLElement | null,
  targetRef: RefObject<HTMLElement | null>,
  enabled = true,
) => {
  useLayoutEffect(() => {
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
