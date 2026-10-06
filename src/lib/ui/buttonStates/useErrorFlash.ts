import { type RefObject, useEffect, useState } from 'react'

/** Первая длительность из CSS-значения (`600ms`, `0.6s`, `0.15s, 0.15s`) в мс. */
export const parseDuration = (value: string): number => {
  const first = value.split(',')[0].trim()
  const parsed = parseFloat(first)
  if (Number.isNaN(parsed)) {
    return 0
  }
  return first.endsWith('ms') ? parsed : parsed * 1000
}

export type ErrorFlashPhase = 'on' | 'off' | undefined

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
        : parseDuration(getComputedStyle(el, '::after').transitionDuration)
    const timer = setTimeout(
      () => setPhase(phase === 'on' ? 'off' : undefined),
      ms,
    )
    return () => clearTimeout(timer)
    // `key` — новая вспышка во время `on` заново отсчитывает удержание.
  }, [ref, phase, key])

  return phase
}
