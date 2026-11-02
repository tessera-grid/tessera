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
import { longestTransition, parseDuration } from '../../util/cssTime'
import { phaseLayerOf } from './useErrorFlash'

import styles from '../ringStates/ringStates.module.css'

export interface ButtonStatesProps {
  /** Ждёт асинхронного действия: дуга по контуру, `aria-busy`, нажатия игнорируются. */
  pending?: boolean
  /**
   * Отмена ждущего действия (ADR 0153): через `--tsr-comp-cancel-arm-delay` после начала
   * ожидания кнопка показывает «стоп» при наведении и фокусе, нажатие отменяет.
   */
  onCancel?: (event: MouseEvent<HTMLButtonElement>) => void
  /** Имя и тултип кнопки со «стопом» — «Отменить: …». */
  cancelLabel?: string
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
 * Отмена взводится через `--tsr-comp-cancel-arm-delay` после начала ожидания: двойной клик
 * не отменяет только что запущенное (ADR 0153, §2). Состояние выводится при рендере, как у
 * угасания дуги.
 */
const useCancelArm = (ref: RefObject<HTMLElement | null>, active: boolean) => {
  const [wasActive, setWasActive] = useState(active)
  const [armed, setArmed] = useState(false)
  if (active !== wasActive) {
    setWasActive(active)
    setArmed(false)
  }

  useEffect(() => {
    const el = ref.current
    if (!active || armed || !el) {
      return
    }
    const delay = parseDuration(
      getComputedStyle(el).getPropertyValue('--tsr-comp-cancel-arm-delay'),
    )
    const timer = setTimeout(() => setArmed(true), delay)
    return () => clearTimeout(timer)
  }, [ref, active, armed])

  return active && armed
}

/**
 * Ожидание и отказ базовой кнопки (ADR 0127, ADR 0177): `failed` — ожидание кончилось
 * отказом, дуга останавливается. `busy` — ожидание, которое отметили
 * снаружи `aria-busy` (серверное действие, ADR 0116): дуга есть, нажатия не глушатся.
 */
export const useButtonStates = <T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
  {
    pending = false,
    failed = false,
    onCancel,
  }: ButtonStatesProps & { failed?: boolean },
  onClick: MouseEventHandler<T> | undefined,
  busy = false,
) => {
  const { own, ref } = useOwnRef(forwardedRef)
  const lit = pending || busy
  const leaving = usePendingLeave(own, lit)
  const armed = useCancelArm(own, lit && !!onCancel)

  const handleClick = (event: MouseEvent<T>) => {
    if (armed) {
      onCancel!(event as unknown as MouseEvent<HTMLButtonElement>)
      return
    }
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
    /** Кнопка в ожидании. */
    active: lit,
    /** Отмена взведена: «стоп» при наведении и фокусе, нажатие отменяет. */
    armed,
  }
}

/**
 * Ожидание контрола-значения — флажка и переключателя (ADR 0176): контрол занят и приглушён
 * так же, как выключенный (`opacity` всего элемента), а дуга — соседний слой в общей
 * обёртке `host` и не гаснет вместе с ним. После ответа дуга гаснет. Нажатия глушит сам
 * контрол: у него своё событие смены значения.
 */
export const usePendingControl = (pending: boolean) => {
  const host = useRef<HTMLSpanElement | null>(null)
  const leaving = usePendingLeave(host, pending)
  const phase: ArcPhase | undefined = pending
    ? 'pending'
    : leaving
      ? 'leaving'
      : undefined
  return {
    /** Обёртка контрола: бокс контрола, дуга — её ребёнок после контрола. */
    host: { ref: host, className: styles.pendingHost },
    /** Атрибуты самого контрола. */
    control: {
      className: styles.ring,
      'aria-busy': pending || undefined,
      'data-pending-outside': phase ? true : undefined,
      'data-pending-leaving': leaving || undefined,
    },
    arc: phase && createElement(PendingArc, { phase, placement: 'outside' }),
  }
}
