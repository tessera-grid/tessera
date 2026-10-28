import { useRef, type RefObject } from 'react'

/**
 * Фокус ещё в закрывающемся попапе или потерян. Иначе пользователь до конца анимации
 * закрытия перешёл к другому элементу (нажал другую кнопку), и возврат фокуса увёл бы
 * его оттуда (ADR 0085, MM6–MM7). Base UI проверяет это сам только при `finalFocus` по
 * умолчанию.
 */
export const focusStayed = (popup: HTMLElement | null) => {
  if (!popup) return true
  const active = popup.ownerDocument.activeElement
  return (
    !active || active === popup.ownerDocument.body || popup.contains(active)
  )
}

/** `finalFocus` попапа на `target` — только если фокус не ушёл к другому элементу. */
export const useFinalFocus = (target: RefObject<HTMLElement | null>) => {
  const popupRef = useRef<HTMLDivElement>(null)
  const finalFocus = () =>
    focusStayed(popupRef.current) && (target.current ?? true)
  return { popupRef, finalFocus }
}
