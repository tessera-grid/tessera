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
import { phaseLayerOf, longestTransition } from './useErrorFlash'

import styles from '../ringStates/ringStates.module.css'

export interface ButtonStatesProps {
  /** Ждёт асинхронного действия: дуга по контуру, `aria-busy`, нажатия игнорируются. */
  pending?: boolean
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
 * Ожидание кончилось: дуга гаснет до конца самого долгого перехода её слоя — после успеха
 * на бегу (BS19), после отказа остановившись (ADR 0136). Фаза выводится при рендере:
 * снятие `aria-busy` и начало угасания — в одном коммите, дуга не мигает.
 */
const usePendingLeave = (ref: RefObject<HTMLElement | null>, lit: boolean) => {
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

  return leaving && !lit
}

/**
 * Ожидание и отказ базовой кнопки (ADR 0127, ADR 0136): `failed` — у кнопки отметка
 * отказа, дуга при конце ожидания останавливается. `busy` — ожидание, которое отметили
 * снаружи `aria-busy` (серверное действие, ADR 0116): дуга есть, нажатия не глушатся.
 */
export const useButtonStates = <T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
  { pending = false, failed = false }: ButtonStatesProps & { failed?: boolean },
  onClick: MouseEventHandler<T> | undefined,
  busy = false,
) => {
  const { own, ref } = useOwnRef(forwardedRef)
  const lit = pending || busy
  const leaving = usePendingLeave(own, lit)

  const handleClick = (event: MouseEvent<T>) => {
    if (pending) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  const phase: ArcPhase | undefined = lit
    ? 'pending'
    : leaving
      ? failed
        ? 'stopping'
        : 'leaving'
      : undefined

  return {
    ref,
    className: styles.ring,
    'aria-busy': pending || undefined,
    'data-pending-leaving': leaving || undefined,
    onClick: handleClick,
    /** Дуга ожидания и отказа — последним ребёнком кнопки. */
    arc: phase && createElement(PendingArc, { phase }),
    /** Кнопка в ожидании: отметка отказа появится, когда ожидание кончится. */
    active: lit,
  }
}
