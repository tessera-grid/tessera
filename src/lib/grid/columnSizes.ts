/**
 * calculateColumnSizes: CSS-переменные ширин и sticky-смещения закреплённых ячеек
 * как `calc()` от `--col-<id>-size`. React-хук со сбором `--*-size` живёт в
 * grid-компоненте и берёт зависимости из useSlice('columnSizing'/'columnResizing') —
 * здесь только чистые функции.
 */
type SizedColumn = { id: string; getSize: () => number }
type SizedHeader = {
  id: string
  getSize: () => number
  column: { id: string; getSize: () => number }
}
/** Для sticky-offset нужны только списки закреплённых-видимых листьев. */
type PinnedLeavesTable = {
  getStartVisibleLeafColumns: () => SizedColumn[]
  getEndVisibleLeafColumns: () => SizedColumn[]
}
/** Для сбора --*-size переменных нужны плоские заголовки и закреплённые слева листья. */
type FlatHeadersTable = {
  getFlatHeaders: () => SizedHeader[]
  getStartVisibleLeafColumns?: () => SizedColumn[]
}

export const getHeaderSizeVariable = (headerId: string) =>
  `--header-${headerId.replace(/\./, '\\.')}-size`

export const getColumnSizeVariable = (columnId: string) =>
  `--col-${columnId.replace(/\./, '\\.')}-size`

/** Сдвиг центральной колонки, пока виртуализатор не пересчитал её смещение (CR18). */
export const getColumnShiftVariable = (columnId: string) =>
  `--col-${columnId.replace(/\./, '\\.')}-shift`

/**
 * `left` центральной виртуализированной ячейки: смещение виртуализатора плюс сдвиг
 * колонок левее, ширины которых он ещё не учёл.
 */
export const getVirtualCellLeft = (columnId: string, left: number) =>
  `calc(${left}px + var(${getColumnShiftVariable(columnId)}, 0px))`

/** Сумма `--col-<id>-size` переменных как `calc(...)` (или '0px' для пустого набора). */
const sumSizeVars = (columns: SizedColumn[]): string =>
  columns.length === 0
    ? '0px'
    : `calc(${columns.map(column => `var(${getColumnSizeVariable(column.id)})`).join(' + ')})`

/**
 * Sticky-смещение слева: сумма размеров закреплённых листьев ДО текущего. Индекс
 * считаем прямо в списке закреплённых-видимых листьев (без column.getIndex —
 * он живёт в columnOrderingFeature, которого может не быть в наборе).
 */
export const getPinnedStartOffset = (
  table: PinnedLeavesTable,
  column: SizedColumn,
): string => {
  const pinned = table.getStartVisibleLeafColumns()
  const index = pinned.findIndex(leaf => leaf.id === column.id)
  return sumSizeVars(index <= 0 ? [] : pinned.slice(0, index))
}

/** Sticky-смещение справа: сумма размеров закреплённых листьев ПОСЛЕ текущего. */
export const getPinnedEndOffset = (
  table: PinnedLeavesTable,
  column: SizedColumn,
): string => {
  const pinned = table.getEndVisibleLeafColumns()
  const index = pinned.findIndex(leaf => leaf.id === column.id)
  return sumSizeVars(index === -1 ? [] : pinned.slice(index + 1))
}

/**
 * Карта CSS-переменных ширин заголовков/колонок (`--header-<id>-size` /
 * `--col-<id>-size`). Чистая; grid-хук оборачивает её мемоизацией по срезам
 * columnSizing/columnResizing (useSlice).
 */
export const buildColumnSizeVars = (
  table: FlatHeadersTable,
): Record<string, string> => {
  const colSizes: Record<string, string> = {}

  for (const header of table.getFlatHeaders()) {
    colSizes[getHeaderSizeVariable(header.id)] = `${header.getSize()}px`
    colSizes[getColumnSizeVariable(header.column.id)] =
      `${header.column.getSize()}px`
  }
  // Ширина закреплённых слева: левый край липкой подписи группы (ADR 0207, §3).
  let pinnedStart = 0
  for (const column of table.getStartVisibleLeafColumns?.() ?? [])
    pinnedStart += column.getSize()
  colSizes['--tsr-pinned-start-width'] = `${pinnedStart}px`

  return colSizes
}

/** CSS-переменные сдвига колонок по карте `columnId → px` (CR18). */
export const columnShiftVars = (
  shifts: Record<string, number>,
): Record<string, string> => {
  const vars: Record<string, string> = {}
  for (const id in shifts) vars[getColumnShiftVariable(id)] = `${shifts[id]}px`
  return vars
}
