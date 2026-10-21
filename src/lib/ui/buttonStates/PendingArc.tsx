import { useState } from 'react'

import styles from '../ringStates/ringStates.module.css'

/** Фаза дуги: ожидание, угасание после успеха, отказ (красный контур), угасание отказа. */
export type ArcPhase = 'pending' | 'leaving' | 'error' | 'off'

/**
 * Радиус средней линии — радиус кнопки без половины толщины дуги; у круга — половина
 * стороны. Читается из вычисленного стиля кнопки при монтировании дуги.
 */
const fitRadius = (svg: SVGSVGElement | null) => {
  const rect = svg?.firstElementChild
  const button = svg?.parentElement
  if (!rect || !button) {
    return
  }
  const radius = getComputedStyle(button).borderTopLeftRadius
  const width =
    parseFloat(
      getComputedStyle(svg).getPropertyValue('--tsr-comp-pending-ring-width'),
    ) || 1
  rect.setAttribute(
    'rx',
    radius.endsWith('%')
      ? '50%'
      : String(Math.max(0, parseFloat(radius) - width / 2)),
  )
}

/**
 * Дуга ожидания кнопки (ADR 0127): бежит по контуру кнопки и повторяет её форму, при
 * отказе дорастает красным до всего контура. Смонтирована, пока у кнопки есть фаза.
 */
export const PendingArc = ({ phase }: { phase: ArcPhase }) => {
  // Отказ, пришедший из ожидания, заполняет контур от длины дуги, без ожидания — от нуля.
  const [fromPending] = useState(phase === 'pending' || phase === 'leaving')
  return (
    <svg
      ref={fitRadius}
      className={styles.arc}
      data-pending-arc=""
      data-phase={phase}
      data-from-pending={fromPending || undefined}
      aria-hidden
      focusable="false"
    >
      <rect width="100%" height="100%" pathLength={100} />
    </svg>
  )
}
