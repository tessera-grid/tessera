import { useEffect, useRef } from 'react'

/** Вертикаль указателя, пока тащат строку; `null` — указатель не двигался или сессии нет. */
export const useDragPointerY = (dragging: boolean) => {
  const y = useRef<number | null>(null)
  useEffect(() => {
    if (!dragging) {
      return
    }
    const onMove = (event: PointerEvent) => {
      y.current = event.clientY
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      y.current = null
    }
  }, [dragging])
  return y
}
