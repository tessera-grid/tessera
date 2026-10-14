/**
 * Сколько кнопок действий помещается в заголовок (ADR 0111): ширина колонки из
 * `columnSizing` и длины токенов темы — без замеров раскладки заголовков. Шапка
 * читает длины токенов пробой раз при монтировании, до отрисовки; без них ширина ряд
 * не ограничивает.
 */
import { type PropsWithChildren, createContext, useRef, useState } from 'react'

import { buttonCapacity } from '../../core/headerActions'
import { useIsomorphicLayoutEffect } from '../../core/useIsomorphicLayoutEffect'

export interface HeaderMetrics {
  /** Отступы содержимого и наименьшая подпись, px. */
  reserve: number
  button: number
  gap: number
  /** Половина зоны грипа ширины — заходит в заголовок справа от него. */
  half: number
}

export const HeaderMetricsContext = createContext<HeaderMetrics | undefined>(
  undefined,
)

/** Длины токенов темы в контексте пробы (`display: none` — без раскладки). */
const readHeaderMetrics = (probe: HTMLElement): HeaderMetrics => {
  const style = getComputedStyle(probe)
  const length = (name: string) => {
    probe.style.width = `var(${name})`
    return parseFloat(style.width)
  }
  probe.style.padding = 'var(--tsr-comp-cell-content-padding)'
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
  return {
    reserve: padding + length('--tsr-comp-head-title-min-width'),
    button: length('--tsr-comp-button-size'),
    gap: length('--tsr-comp-cell-content-gap'),
    half: length('--tsr-comp-resize-handler-width') / 2,
  }
}

/** Длины для расчёта вместимости — заголовкам шапки. */
export const HeaderMetricsProvider = ({ children }: PropsWithChildren) => {
  const probe = useRef<HTMLSpanElement>(null)
  const [metrics, setMetrics] = useState<HeaderMetrics>()
  useIsomorphicLayoutEffect(() => {
    if (!probe.current) return
    const next = readHeaderMetrics(probe.current)
    if (!Object.values(next).some(Number.isNaN)) setMetrics(next)
  }, [])
  return (
    <HeaderMetricsContext.Provider value={metrics}>
      {children}
      <span ref={probe} hidden />
    </HeaderMetricsContext.Provider>
  )
}

interface HeaderLike {
  index: number
  getSize: () => number
  headerGroup?: { headers: { column: { getCanResize?: () => boolean } }[] }
}

/** Вместимость ряда кнопок заголовка; `undefined` — не ограничивает. */
export const headerCapacityOf = (
  header: HeaderLike | undefined,
  metrics: HeaderMetrics | undefined,
): number | undefined => {
  if (!header?.getSize || !metrics) return undefined
  // Грип соседа слева заходит в заголовок на половину зоны (ADR 0111).
  const previous = header.headerGroup?.headers[header.index - 1]
  const afterResizable = previous?.column.getCanResize?.() ?? false
  return buttonCapacity({
    width: header.getSize(),
    reserve: metrics.reserve + (afterResizable ? metrics.half : 0),
    button: metrics.button,
    gap: metrics.gap,
  })
}
