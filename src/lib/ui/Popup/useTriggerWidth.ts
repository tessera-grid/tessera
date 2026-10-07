import { useCallback, useRef, useState } from 'react'

/**
 * Ширина триггера списка Select, снятая при открытии: попап получает `min-width` с
 * первой раскладки. `var(--anchor-width)` Base UI задаёт уже после замера
 * позиционера, попап меняет размер внутри `ResizeObserver` и окно получает ошибку
 * «ResizeObserver loop» (ADR 0017, PP8).
 */
export const useTriggerWidth = () => {
  const trigger = useRef<HTMLElement | null>(null)
  const [width, setWidth] = useState<number>()

  const setTrigger = useCallback((node: HTMLElement | null) => {
    trigger.current = node
  }, [])

  const onOpenChange = useCallback((open: boolean) => {
    if (open) setWidth(trigger.current?.offsetWidth)
  }, [])

  return { setTrigger, onOpenChange, minWidth: width }
}
