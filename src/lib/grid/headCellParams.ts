import type { Header } from '../types'
import { getDisplayColumnIndex } from '../core/displayColumns'
import { getPinnedEndOffset, getPinnedStartOffset } from './columnSizes'

export const getAriaSort = (
  header: Header<any, any, unknown>,
): 'ascending' | 'descending' | 'none' | undefined => {
  if (!(header.column.getCanSort?.() ?? false)) {
    return undefined
  }
  const sorted = header.column.getIsSorted?.()
  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'
  return 'none'
}

/**
 * Пиннинг по листьям ячейки-заголовка (reorder-out: сегмент закреплён, только если
 * все его листья закреплены на одной стороне). start/end (v9).
 */
export const getHeaderPinning = (header: Header<any, any, unknown>) => {
  const table = header.getContext().table
  const leafCols = header.getLeafHeaders().map(leaf => leaf.column)
  const firstLeaf = leafCols[0] ?? header.column
  const lastLeaf = leafCols.at(-1) ?? header.column
  const isStartPinned =
    leafCols.length > 0 && leafCols.every(c => c.getIsPinned() === 'start')
  const isEndPinned =
    leafCols.length > 0 && leafCols.every(c => c.getIsPinned() === 'end')
  const headerPinned: 'start' | 'end' | false = isStartPinned
    ? 'start'
    : isEndPinned
      ? 'end'
      : false

  const startCols = (table as any).getStartVisibleLeafColumns() as {
    id: string
  }[]
  const endCols = (table as any).getEndVisibleLeafColumns() as { id: string }[]

  return {
    firstLeaf,
    headerPinned,
    isLastStartPinnedColumn:
      isStartPinned && startCols.at(-1)?.id === lastLeaf.id,
    isFirstEndPinnedColumn: isEndPinned && endCols[0]?.id === firstLeaf.id,
    startPinnedOffset: isStartPinned
      ? getPinnedStartOffset(table as never, firstLeaf as never)
      : undefined,
    endPinnedOffset: isEndPinned
      ? getPinnedEndOffset(table as never, lastLeaf as never)
      : undefined,
  }
}

/**
 * Значения ячейки заголовка, зависящие от состояния таблицы: на них — и только на них —
 * подписана ячейка (ADR 0099, PF5). Структура шапки приходит новыми объектами `header`.
 */
export const getHeadCellState = (header: Header<any, any, unknown>) => {
  const table = header.getContext().table as {
    getHeaderGroups: () => unknown[]
  }
  const {
    firstLeaf,
    headerPinned,
    isLastStartPinnedColumn,
    isFirstEndPinnedColumn,
    startPinnedOffset,
    endPinnedOffset,
  } = getHeaderPinning(header)
  return {
    firstLeafId: firstLeaf.id,
    headerPinned,
    isLastStartPinnedColumn,
    isFirstEndPinnedColumn,
    startPinnedOffset,
    endPinnedOffset,
    canResize: header.column.getCanResize?.() ?? false,
    isResizing: header.column.getIsResizing?.() ?? false,
    ariaSort: getAriaSort(header),
    displayIndex: getDisplayColumnIndex(table as never, firstLeaf.id),
    headerRows: table.getHeaderGroups().length,
  }
}
