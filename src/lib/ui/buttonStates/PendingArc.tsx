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
 * Радиус средней линии — радиус кнопки без половины толщины дуги; у дуги снаружи — радиус
 * контрола плюс зазор и половина толщины; у круга — половина стороны. Читается из
 * вычисленного стиля контрола при монтировании дуги.
 */
const fitRadius = (svg: SVGSVGElement | null) => {
  const button =
    svg?.dataset.placement === 'outside'
      ? // Контрол — первый в обёртке: за ним Base UI ставит скрытое поле формы.
        (svg.parentElement?.firstElementChild ?? svg.parentElement)
      : svg?.parentElement
  if (!svg || !button) {
    return
  }
  const radius = getComputedStyle(button).borderTopLeftRadius
  const width =
    parseFloat(
      getComputedStyle(svg).getPropertyValue('--tsr-comp-pending-ring-width'),
    ) || 1
  const outside = svg.dataset.placement === 'outside'
  // Не больше половины меньшей стороны: иначе SVG скругляет эллипсом, а не капсулой.
  const box = getComputedStyle(svg)
  const half =
    Math.min(parseFloat(box.width), parseFloat(box.height)) / 2 || Infinity
  const rx = radius.endsWith('%')
    ? '50%'
    : String(
        Math.min(
          half,
          Math.max(
            0,
            outside
              ? parseFloat(radius) + width * 1.5
              : parseFloat(radius) - width / 2,
          ),
        ),
      )
  svg.querySelectorAll('rect').forEach(rect => rect.setAttribute('rx', rx))
}

/**
 * Дуга ожидания кнопки (ADR 0127): над бледной дорожкой по контуру бежит дуга с хвостом и
 * повторяет форму кнопки; при отказе дуга встаёт и гаснет вместе с дорожкой (ADR 0136).
 * Смонтирована, пока у кнопки есть фаза. `outside` — дуга вокруг контрола с зазором, а не
 * по его краю: у флажка и переключателя край занят заливкой и рамкой (ADR 0176).
 */
export const PendingArc = ({
  phase,
  placement,
}: {
  phase: ArcPhase
  placement?: 'outside'
}) => {
  return (
    <svg
      ref={fitRadius}
      className={styles.arc}
      data-pending-arc=""
      data-phase={phase}
      data-placement={placement}
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
