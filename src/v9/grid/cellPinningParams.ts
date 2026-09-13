/**
 * Cutover (grid-слой) — v9-порт useCellPinningParams: флаги закреплённой ячейки +
 * sticky-смещения. Логическая сторона start/end (v8 left/right). Крайние/первые
 * флаги считаются в списках getStart/EndVisibleLeafColumns (без column.getIndex/
 * getIsLastColumn — они из columnOrderingFeature, не всегда в наборе).
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

type PinnedColumn = { id: string; getSize: () => number; getIsPinned: () => false | 'start' | 'end' }
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

export const getCellPinningParams = (
  table: PinningTable,
  column: PinnedColumn,
): CellPinningParams => {
  const pinned = column.getIsPinned()
  const isStartPinned = pinned === 'start'
  const isEndPinned = pinned === 'end'

  const start = table.getStartVisibleLeafColumns()
  const end = table.getEndVisibleLeafColumns()
  const startIndex = start.findIndex(leaf => leaf.id === column.id)
  const endIndex = end.findIndex(leaf => leaf.id === column.id)

  return {
    isStartPinned,
    isEndPinned,
    isLastStartPinnedColumn: isStartPinned && startIndex === start.length - 1,
    isLastEndPinnedColumn: isEndPinned && endIndex === end.length - 1,
    isFirstEndPinnedColumn: isEndPinned && endIndex === 0,
    isAloneEndPinnedColumn: isEndPinned && end.length === 1,
    startPinnedOffset: isStartPinned ? getPinnedStartOffset(table, column) : undefined,
    endPinnedOffset: isEndPinned ? getPinnedEndOffset(table, column) : undefined,
  }
}
