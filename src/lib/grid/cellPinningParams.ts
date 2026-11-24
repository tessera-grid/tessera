/**
 * useCellPinningParams: флаги закреплённой ячейки + sticky-смещения (сторона
 * start/end). Крайние/первые флаги считаются в списках getStart/EndVisibleLeafColumns
 * (без column.getIndex/getIsLastColumn — они из columnOrderingFeature, не всегда в
 * наборе).
 */
import { getPinnedEndOffset, getPinnedStartOffset } from './columnSizes'

/**
 * v9 пиннинг оперирует `start`/`end`, но DOM-контракт грида (CSS-селекторы,
 * визуальные тесты, потребительские стили) остался на `left`/`right` — маппим
 * значение `data-cell-pinned` обратно, сохраняя контракт разметки.
 */
export const pinnedSideToDom = (
  side: false | 'start' | 'end',
): false | 'left' | 'right' =>
  side === 'start' ? 'left' : side === 'end' ? 'right' : side

type PinnedColumn = {
  id: string
  getSize: () => number
  getIsPinned: () => false | 'start' | 'end'
}
type PinningTable = {
  getStartVisibleLeafColumns: () => { id: string; getSize: () => number }[]
  getEndVisibleLeafColumns: () => { id: string; getSize: () => number }[]
}

export interface CellPinningParams {
  isStartPinned: boolean
  isEndPinned: boolean
  isLastStartPinnedColumn: boolean
  isLastEndPinnedColumn: boolean
  isFirstEndPinnedColumn: boolean
  isAloneEndPinnedColumn: boolean
  startPinnedOffset: string | undefined
  endPinnedOffset: string | undefined
}

const UNPINNED = Object.freeze({
  isStartPinned: false,
  isEndPinned: false,
  isLastStartPinnedColumn: false,
  isLastEndPinnedColumn: false,
  isFirstEndPinnedColumn: false,
  isAloneEndPinnedColumn: false,
  startPinnedOffset: undefined,
  endPinnedOffset: undefined,
})

export const getCellPinningParams = (
  table: PinningTable,
  column: PinnedColumn,
): CellPinningParams => {
  const pinned = column.getIsPinned()
  if (!pinned) return UNPINNED
  const isStartPinned = pinned === 'start'
  const isEndPinned = pinned === 'end'
  const siblings = isStartPinned
    ? table.getStartVisibleLeafColumns()
    : table.getEndVisibleLeafColumns()
  const index = siblings.findIndex(leaf => leaf.id === column.id)

  return {
    isStartPinned,
    isEndPinned,
    isLastStartPinnedColumn: isStartPinned && index === siblings.length - 1,
    isLastEndPinnedColumn: isEndPinned && index === siblings.length - 1,
    isFirstEndPinnedColumn: isEndPinned && index === 0,
    isAloneEndPinnedColumn: isEndPinned && siblings.length === 1,
    startPinnedOffset: isStartPinned
      ? getPinnedStartOffset(table, column)
      : undefined,
    endPinnedOffset: isEndPinned
      ? getPinnedEndOffset(table, column)
      : undefined,
  }
}
