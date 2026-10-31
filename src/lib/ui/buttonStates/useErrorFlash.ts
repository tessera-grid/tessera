import { type RefObject, useEffect, useState } from 'react'

import { longestTransition, parseDuration } from '../../util/cssTime'

export type ErrorFlashPhase = 'on' | 'off' | undefined

/**
 * Стиль слоя, который ведёт фазу носителя: дуга кнопки (ADR 0127), а без неё — `::after`
 * (полоса загрузки).
 */
export const phaseLayerOf = (el: HTMLElement): CSSStyleDeclaration => {
  const arc = el.querySelector(':scope > [data-pending-arc]')
  return arc ? getComputedStyle(arc) : getComputedStyle(el, '::after')
}

/**
 * Вспышка ошибки кнопки (ADR 0055): каждое новое значение `key` заливает контур цветом
 * ошибки на `--tsr-comp-error-flash-duration` (`on`), затем он гаснет переходом движения
 * (`off`). Значение при монтировании вспышку не запускает.
 *
 * Фаза выводится при рендере, а не ставится эффектом: снятие `aria-busy` и начало
 * вспышки попадают в один коммит. Иначе пересчёт стилей между ними (чтение стилей
 * соседней кнопкой) убирал бы `::after`, и блик прыгал бы в начало.
 */
export const useErrorFlash = (
  ref: RefObject<HTMLElement | null>,
  key: number | undefined,
): ErrorFlashPhase => {
  const [seen, setSeen] = useState(key)
  const [phase, setPhase] = useState<ErrorFlashPhase>(undefined)

  if (key !== seen) {
    setSeen(key)
    if (key !== undefined) {
      setPhase('on')
    }
  }

  useEffect(() => {
    const el = ref.current
    if (phase === undefined || !el) {
      return
    }
    const ms =
      phase === 'on'
        ? parseDuration(
            getComputedStyle(el).getPropertyValue(
              '--tsr-comp-error-flash-duration',
            ),
          )
        : longestTransition(phaseLayerOf(el))
    const timer = setTimeout(
      () => setPhase(phase === 'on' ? 'off' : undefined),
      ms,
    )
    return () => clearTimeout(timer)
    // `key` — новая вспышка во время `on` заново отсчитывает удержание.
  }, [ref, phase, key])

  return phase
}
