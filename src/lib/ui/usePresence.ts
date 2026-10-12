import { useEffect, useRef, useState } from 'react'

import { parseDuration } from './buttonStates/useErrorFlash'

/**
 * Плавное появление и уход элемента: появление — CSS-анимацией самого элемента, уход —
 * элемент остаётся смонтированным с `data-leaving` на время своего перехода (длительность
 * — из вычисленного стиля, при уменьшенном движении — ноль). `@starting-style` порог
 * браузеров не пропускает (ADR 0084).
 */
export const usePresence = <T extends HTMLElement>(shown: boolean) => {
  const [mounted, setMounted] = useState(shown)
  if (shown && !mounted) {
    setMounted(true)
  }
  const leaving = mounted && !shown
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!leaving) {
      return
    }
    const el = ref.current
    const ms = el ? parseDuration(getComputedStyle(el).transitionDuration) : 0
    const timer = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(timer)
  }, [leaving])

  return { mounted: mounted || shown, leaving, ref }
}
