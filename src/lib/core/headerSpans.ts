/**
 * Спаны ячейки шапки по TanStack v9 (ADR 0049): вершина цепочки плейсхолдеров
 * несёт `rowSpan` всей цепочки, покрытые ею заголовки — `rowSpan: 0`.
 */
export interface SpanHeader {
  rowSpan: number
  colSpan: number
  headerGroup: { depth: number } | null
}

/** Заголовок покрыт вершиной своей цепочки и не рисуется. */
export const isCoveredHeader = (header: Pick<SpanHeader, 'rowSpan'>): boolean =>
  header.rowSpan === 0

/** Верхняя строка шапки, которую занимает заголовок (0 — верхняя). */
export const getHeaderRowStart = (
  header: Pick<SpanHeader, 'headerGroup'>,
): number => header.headerGroup?.depth ?? 0

/** Строки шапки, которые заголовок занимает (0 — верхняя); покрытый — ни одной. */
export const getHeaderRows = (
  header: Pick<SpanHeader, 'rowSpan' | 'headerGroup'>,
): number[] => {
  const start = getHeaderRowStart(header)
  return Array.from({ length: header.rowSpan }, (_, row) => start + row)
}
