import {
  type ForwardedRef,
  type MouseEvent,
  type MouseEventHandler,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { assignRef } from '../assignRef'
import {
  type ErrorFlashPhase,
  longestTransition,
  useErrorFlash,
} from './useErrorFlash'

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
      // Своя фаза света ожидания: соседние кнопки не идут в ногу. Одна на узел: новый
      // ref снаружи на каждом рендере сдвигал бы свет и пересчитывал его стиль (MI23).
      if (node && !node.style.getPropertyValue('--tsr-pending-phase')) {
        node.style.setProperty('--tsr-pending-phase', String(Math.random()))
      }
      assignRef(forwardedRef, node)
    },
    [forwardedRef],
  )
  return { own, ref }
}

/**
 * Ожидание кончилось без ошибки: свет ещё живёт и гаснет переходом до конца самого
 * долгого перехода `::after` (ADR 0055, BS19). Фаза выводится при рендере, как вспышка:
 * снятие `aria-busy` и начало угасания — в одном коммите, свет не мигает.
 */
const usePendingLeave = (
  ref: RefObject<HTMLElement | null>,
  pending: boolean,
  flash: ErrorFlashPhase,
) => {
  const [wasPending, setWasPending] = useState(pending)
  const [leaving, setLeaving] = useState(false)
  if (pending !== wasPending) {
    setWasPending(pending)
    setLeaving(!pending)
  }

  useEffect(() => {
    const el = ref.current
    if (!leaving || !el) {
      return
    }
    const timer = setTimeout(
      () => setLeaving(false),
      longestTransition(getComputedStyle(el, '::after')),
    )
    return () => clearTimeout(timer)
  }, [ref, leaving])

  // Вспышка ошибки сама ведёт свет дальше — угасание ей не нужно.
  return leaving && !pending && flash === undefined
}

/** Ожидание и вспышка ошибки базовой кнопки (ADR 0055). */
export const useButtonStates = <T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
  { pending = false, errorFlash }: ButtonStatesProps,
  onClick: MouseEventHandler<T> | undefined,
) => {
  const { own, ref } = useOwnRef(forwardedRef)
  const flash = useErrorFlash(own, errorFlash)
  const leaving = usePendingLeave(own, pending, flash)

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
    'data-pending-leaving': leaving || undefined,
    onClick: handleClick,
  }
}
