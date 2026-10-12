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

/**
 * Свой ref кнопки и переданный снаружи. Отдельный хук: стабильный колбэк живёт, пока
 * смонтирована кнопка, и в общем с `handleClick` контексте держал бы `onClick` первого
 * рендера, а с ним — строку и данные, которые тот замкнул (ADR 0092).
 */
const useOwnRef = <T extends HTMLElement>(forwardedRef: ForwardedRef<T>) => {
  const own = useRef<T | null>(null)
  const ref = useCallback(
    (node: T | null) => {
      own.current = node
      // Своя фаза света ожидания: соседние кнопки не идут в ногу.
      node?.style.setProperty('--tsr-pending-phase', String(Math.random()))
      assignRef(forwardedRef, node)
    },
    [forwardedRef],
  )
  return { own, ref }
}

/** Ожидание и вспышка ошибки базовой кнопки (ADR 0055). */
export const useButtonStates = <T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
  { pending = false, errorFlash }: ButtonStatesProps,
  onClick: MouseEventHandler<T> | undefined,
) => {
  const { own, ref } = useOwnRef(forwardedRef)
  const flash = useErrorFlash(own, errorFlash)

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
