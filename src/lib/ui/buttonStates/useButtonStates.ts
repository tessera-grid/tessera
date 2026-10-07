import {
  type ForwardedRef,
  type MouseEvent,
  type MouseEventHandler,
  useCallback,
  useRef,
} from 'react'

import { assignRef } from '../assignRef'
import { useErrorFlash } from './useErrorFlash'

import styles from '../ringStates/ringStates.module.css'

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
      assignRef(forwardedRef, node)
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
    className: styles.ring,
    'aria-busy': pending || undefined,
    'data-error-flash': flash,
    onClick: handleClick,
  }
}
