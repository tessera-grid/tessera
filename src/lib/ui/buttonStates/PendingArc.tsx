import type { CSSProperties } from 'react'

import styles from '../ringStates/ringStates.module.css'

/** Фаза дуги: ожидание, угасание после успеха, остановка и угасание после отказа. */
export type ArcPhase = 'pending' | 'leaving' | 'stopping'

/**
 * Отрезки хвоста с общей головой: `i`-й — `i/N` длины дуги с непрозрачностью `1/i`, в
 * сумме плотность растёт от конца к голове ровно.
 */
const TAIL = Array.from({ length: 8 }, (_, i) => i + 1)

/**
 * Радиус средней линии — радиус кнопки без половины толщины дуги; у круга — половина
 * стороны. Читается из вычисленного стиля кнопки при монтировании дуги.
 */
const fitRadius = (svg: SVGSVGElement | null) => {
  const button = svg?.parentElement
  if (!svg || !button) {
    return
  }
  const radius = getComputedStyle(button).borderTopLeftRadius
  const width =
    parseFloat(
      getComputedStyle(svg).getPropertyValue('--tsr-comp-pending-ring-width'),
    ) || 1
  const rx = radius.endsWith('%')
    ? '50%'
    : String(Math.max(0, parseFloat(radius) - width / 2))
  svg.querySelectorAll('rect').forEach(rect => rect.setAttribute('rx', rx))
}

/**
 * Дуга ожидания кнопки (ADR 0127): над бледной дорожкой по контуру бежит дуга с хвостом и
 * повторяет форму кнопки; при отказе дуга встаёт и гаснет вместе с дорожкой (ADR 0136).
 * Смонтирована, пока у кнопки есть фаза.
 */
export const PendingArc = ({ phase }: { phase: ArcPhase }) => {
  return (
    <svg
      ref={fitRadius}
      className={styles.arc}
      data-pending-arc=""
      data-phase={phase}
      aria-hidden
      focusable="false"
    >
      <rect
        className={styles.arcTrack}
        width="100%"
        height="100%"
        pathLength={100}
      />
      <g className={styles.arcTail}>
        {TAIL.map(i => (
          <rect
            key={i}
            width="100%"
            height="100%"
            pathLength={100}
            style={{ '--_i': i } as CSSProperties}
          />
        ))}
      </g>
    </svg>
  )
}
