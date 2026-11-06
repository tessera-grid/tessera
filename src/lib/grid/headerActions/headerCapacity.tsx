/**
 * Сколько кнопок действий помещается в заголовок (ADR 0111): ширина колонки из
 * `columnSizing` и длины токенов темы — без замеров раскладки заголовков. Шапка
 * читает длины токенов пробой раз при монтировании, до отрисовки; без них ширина ряд
 * не ограничивает.
 */
import { type PropsWithChildren, createContext, useRef, useState } from 'react'

import { buttonCapacity } from '../../core/headerActions'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'

export interface HeaderMetrics {
  /** Отступ слева и наименьшая подпись, px. */
  reserve: number
  /** Место справа от последней кнопки у колонки без грипа (ADR 0135). */
  right: number
  button: number
  gap: number
  /** Половина зоны грипа ширины — заходит в заголовок справа от него. */
  half: number
  /** Промежуток между последней кнопкой и зоной своего грипа (ADR 0135). */
  gripGap: number
  /** Сдвиг подписи раскрытой ручкой перетаскивания колонки (ADR 0114). */
  handle: number
  /** Тот же сдвиг после гриповой колонки слева: ручка — за зоной её грипа (ADR 0135). */
  handleAfterGrip: number
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
  const padding = length('--tsr-comp-cell-content-padding-x')
  const button = length('--tsr-comp-grid-button-size')
  // Без грипа последняя кнопка заходит в отступ на пустоту вокруг иконки (ADR 0135).
  const edge = Math.min(
    (button - length('--tsr-comp-button-icon-size')) / 2,
    padding,
  )
  const half = length('--tsr-comp-resize-handler-width') / 2
  const gripStart = length('--tsr-comp-head-grip-start')
  const gap = length('--tsr-comp-cell-content-gap')
  // Между кнопками — свой промежуток, меньше, чем до подписи (ADR 0135).
  const buttonGap = length('--tsr-comp-head-button-gap')
  const handleShift = (inset: number) =>
    Math.max(
      0,
      length('--tsr-comp-button-size-compact') + inset - padding + gap,
    )
  return {
    reserve: padding + length('--tsr-comp-head-title-min-width'),
    right: padding - edge,
    button,
    gap: buttonGap,
    half,
    gripGap: length('--tsr-comp-head-grip-gap'),
    handle: handleShift(length('--tsr-comp-drag-handle-inset')),
    handleAfterGrip: handleShift(half * 2 - gripStart),
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

interface ColumnLike {
  getCanDrag?: () => boolean
  getCanResize?: () => boolean
  getIsPinned?: () => unknown
}

interface HeaderLike {
  index: number
  getSize: () => number
  column?: ColumnLike
  headerGroup?: { headers: { column: ColumnLike }[] }
}

const isEndPinned = (column: ColumnLike | undefined) => {
  const side = column?.getIsPinned?.()
  return side === 'end' || side === 'right'
}

/** Вместимость ряда кнопок заголовка; `undefined` — не ограничивает. */
export const headerCapacityOf = (
  header: HeaderLike | undefined,
  metrics: HeaderMetrics | undefined,
): number | undefined => {
  if (!header?.getSize || !metrics) return undefined
  const headers = header.headerGroup?.headers
  // Зона грипа соседа слева — в этой колонке (ADR 0111).
  const previous = headers?.[header.index - 1]
  const afterResizable = previous?.column.getCanResize?.() ?? false
  // Раскрытая ручка перетаскивания — кнопка перед подписью (ADR 0114); после гриповой
  // колонки — за зоной её грипа.
  const handle =
    !!header.column?.getCanDrag?.() && !header.column.getIsPinned?.()
  const handleShift = afterResizable ? metrics.handleAfterGrip : metrics.handle
  // Своя зона грипа есть только у последней колонки и перед правыми закреплёнными.
  const next = headers?.[header.index + 1]
  const gripInside =
    headers &&
    (!next || (isEndPinned(next.column) && !isEndPinned(header.column)))
  const right = !header.column?.getCanResize?.()
    ? metrics.right
    : gripInside
      ? metrics.half * 2 + metrics.gripGap
      : metrics.half
  return buttonCapacity({
    width: header.getSize(),
    reserve: metrics.reserve + right + (handle ? handleShift : 0),
    button: metrics.button,
    gap: metrics.gap,
  })
}
