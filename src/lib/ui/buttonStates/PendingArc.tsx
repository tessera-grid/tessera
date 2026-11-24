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
const radiusOf = (svg: SVGSVGElement) => {
  if (!svg.isConnected) return
  const outside = svg.dataset.placement === 'outside'
  const button = outside
    ? // Контрол — первый в обёртке: за ним Base UI ставит скрытое поле формы.
      (svg.parentElement?.firstElementChild ?? svg.parentElement)
    : svg.parentElement
  if (!button) return
  const radius = getComputedStyle(button).borderTopLeftRadius
  if (radius.endsWith('%')) return '50%'
  const box = getComputedStyle(svg)
  const width =
    parseFloat(box.getPropertyValue('--tsr-comp-pending-ring-width')) || 1
  // Не больше половины меньшей стороны: иначе SVG скругляет эллипсом, а не капсулой.
  const half =
    Math.min(parseFloat(box.width), parseFloat(box.height)) / 2 || Infinity
  const value = parseFloat(radius) + (outside ? width * 1.5 : -width / 2)
  return `${Math.min(half, Math.max(0, value))}px`
}

let pendingFit: Set<SVGSVGElement> | undefined

/** В одном коммите может появиться целый ряд дуг. Сначала читаем раскладку, затем пишем. */
const fitRadius = (svg: SVGSVGElement | null) => {
  if (!svg) return
  if (pendingFit) {
    pendingFit.add(svg)
    return
  }
  const batch = new Set([svg])
  pendingFit = batch
  queueMicrotask(() => {
    pendingFit = undefined
    const radii = Array.from(batch, svg => [svg, radiusOf(svg)] as const)
    for (const [svg, radius] of radii) {
      if (radius !== undefined) svg.style.setProperty('--_radius', radius)
    }
  })
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
