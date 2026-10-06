import {
  type ForwardedRef,
  type MouseEvent,
  type MouseEventHandler,
  useCallback,
  useRef,
} from 'react'

import { useErrorFlash } from './useErrorFlash'

import styles from './buttonStates.module.css'

export interface ButtonStatesProps {
  /** Ждёт асинхронного действия: кольцо по контуру, `aria-busy`, нажатия игнорируются. */
  pending?: boolean
  /** Ключ вспышки ошибки: каждое новое значение — вспышка (ADR 0055). */
  errorFlash?: number
}

/** Ожидание и вспышка ошибки базовой кнопки (ADR 0055). */
export const useButtonStates = <T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
  { pending = false, errorFlash }: ButtonStatesProps,
  onClick: MouseEventHandler<T> | undefined,
) => {
  const own = useRef<T | null>(null)
  const flash = useErrorFlash(own, errorFlash)

  const ref = useCallback(
    (node: T | null) => {
      own.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    },
    [forwardedRef],
  )

  const handleClick = (event: MouseEvent<T>) => {
    if (pending) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return {
    ref,
    className: styles.states,
    'aria-busy': pending || undefined,
    'data-error-flash': flash,
    onClick: handleClick,
  }
}
