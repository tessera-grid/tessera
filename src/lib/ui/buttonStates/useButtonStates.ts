import {
  type ForwardedRef,
  type MouseEvent,
  type MouseEventHandler,
  type RefObject,
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { assignRef } from '../assignRef'
import { type ArcPhase, PendingArc } from './PendingArc'
import {
  type ErrorFlashPhase,
  phaseLayerOf,
  longestTransition,
  useErrorFlash,
} from './useErrorFlash'

import styles from '../ringStates/ringStates.module.css'

export interface ButtonStatesProps {
  /** Ждёт асинхронного действия: дуга по контуру, `aria-busy`, нажатия игнорируются. */
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
      assignRef(forwardedRef, node)
    },
    [forwardedRef],
  )
  return { own, ref }
}

/**
 * Ожидание кончилось без ошибки: дуга ещё бежит и гаснет переходом до конца самого
 * долгого перехода её слоя (ADR 0055, BS19). Фаза выводится при рендере, как вспышка:
 * снятие `aria-busy` и начало угасания — в одном коммите, дуга не мигает.
 */
const usePendingLeave = (
  ref: RefObject<HTMLElement | null>,
  lit: boolean,
  flash: ErrorFlashPhase,
) => {
  const [wasLit, setWasLit] = useState(lit)
  const [leaving, setLeaving] = useState(false)
  if (lit !== wasLit) {
    setWasLit(lit)
    setLeaving(!lit)
  }

  useEffect(() => {
    const el = ref.current
    if (!leaving || !el) {
      return
    }
    const timer = setTimeout(
      () => setLeaving(false),
      longestTransition(phaseLayerOf(el)),
    )
    return () => clearTimeout(timer)
  }, [ref, leaving])

  // Вспышка ошибки сама ведёт дугу дальше — угасание ей не нужно.
  return leaving && !lit && flash === undefined
}

/**
 * Ожидание и вспышка ошибки базовой кнопки (ADR 0055, ADR 0127). `busy` — ожидание,
 * которое отметили снаружи `aria-busy` (серверное действие, ADR 0116): дуга есть, нажатия
 * не глушатся.
 */
export const useButtonStates = <T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
  { pending = false, errorFlash }: ButtonStatesProps,
  onClick: MouseEventHandler<T> | undefined,
  busy = false,
) => {
  const { own, ref } = useOwnRef(forwardedRef)
  const flash = useErrorFlash(own, errorFlash)
  const lit = pending || busy
  const leaving = usePendingLeave(own, lit, flash)

  const handleClick = (event: MouseEvent<T>) => {
    if (pending) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  const phase: ArcPhase | undefined =
    flash === 'on'
      ? 'error'
      : flash === 'off'
        ? 'off'
        : lit
          ? 'pending'
          : leaving
            ? 'leaving'
            : undefined

  return {
    ref,
    className: styles.ring,
    'aria-busy': pending || undefined,
    'data-error-flash': flash,
    'data-pending-leaving': leaving || undefined,
    onClick: handleClick,
    /** Дуга ожидания и отказа — последним ребёнком кнопки. */
    arc: phase && createElement(PendingArc, { phase }),
    /** Кнопка в ожидании или с красным контуром: отметка отказа появится, когда он погаснет. */
    active: lit || flash !== undefined,
  }
}
