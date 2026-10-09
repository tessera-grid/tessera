/**
 * Высота строк тела и шапки (ADR 0077): числа от приложения, прижатые к наименьшей
 * высоте, при которой кнопки строки и их контур фокуса не обрезаются.
 */
export const DEFAULT_ROW_HEIGHT = 50
/** Кнопка раскрытия 36px и контур фокуса 2px с каждой стороны. */
export const MIN_ROW_HEIGHT = 40
/** Кнопки шапки 32px и контур фокуса 2px с каждой стороны. */
export const MIN_HEADER_HEIGHT = 36

export const ROW_HEIGHT_VAR = '--tsr-comp-row-height'
export const HEAD_ROW_HEIGHT_VAR = '--tsr-comp-head-row-height'

export interface RowHeightOptions {
  rowHeight?: number
  headerHeight?: number
}

export interface ResolvedRowHeights {
  /** Высота строки тела от приложения после прижатия; `undefined` — из темы. */
  row?: number
  head?: number
  warnings: string[]
}

const clamp = (
  name: keyof RowHeightOptions,
  value: number | undefined,
  min: number,
  warnings: string[],
) => {
  if (value === undefined) {
    return undefined
  }
  if (!(value >= min)) {
    warnings.push(
      `${name}: ${value} is below the minimum ${min}px; using ${min}px`,
    )
    return min
  }
  return value
}

export const resolveRowHeights = ({
  rowHeight,
  headerHeight,
}: RowHeightOptions): ResolvedRowHeights => {
  const warnings: string[] = []
  return {
    row: clamp('rowHeight', rowHeight, MIN_ROW_HEIGHT, warnings),
    head: clamp('headerHeight', headerHeight, MIN_HEADER_HEIGHT, warnings),
    warnings,
  }
}

/** Значение токена высоты в px; пусто или не число — `fallback`. */
export const readHeightVar = (
  style: CSSStyleDeclaration,
  name: string,
  fallback: number,
) => parseFloat(style.getPropertyValue(name)) || fallback
