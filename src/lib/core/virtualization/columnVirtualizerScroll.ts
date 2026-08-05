import { CSSProperties } from 'react'

import { Table } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'

interface ColumnVirtualizerScrollParams {
  table: Table
  virtualColumns: VirtualItem[]
  columnsTotalSize: number
}

/**
 * @link https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-columns
 */
export const useColumnVirtualizerScroll = ({
  table,
  virtualColumns,
  columnsTotalSize,
}: ColumnVirtualizerScrollParams) => {
  const visibleColumns = table.getVisibleLeafColumns()
  const visibleColumnsCount = visibleColumns.length

  const leftVisibleColumns = table.getLeftVisibleLeafColumns()
  const rightVisibleColumns = table.getRightVisibleLeafColumns()

  const [leftPinnedIndexes, rightPinnedIndexes] = [
    leftVisibleColumns.map(c => c.getPinnedIndex()),
    rightVisibleColumns
      .map(column => visibleColumnsCount - column.getPinnedIndex() - 1)
      .sort((a, b) => a - b),
  ]

  const sizePinnedLeft = leftPinnedIndexes.length
  const sizePinnedRight = rightPinnedIndexes.length
  const sizeColumns = virtualColumns.length

  let virtualPaddingLeft = 0
  let virtualPaddingRight = 0

  if (virtualColumns.length) {
    if (sizeColumns) {
      const leftNonPinnedStart = virtualColumns[sizePinnedLeft]?.start || 0
      const leftNonPinnedEnd =
        virtualColumns[leftPinnedIndexes.length - 1]?.end || 0

      const rightNonPinnedStart =
        virtualColumns[sizeColumns - sizePinnedRight]?.start || 0
      const rightNonPinnedEnd =
        virtualColumns[sizeColumns - sizePinnedRight - 1]?.end || 0

      virtualPaddingLeft = leftNonPinnedStart - leftNonPinnedEnd

      virtualPaddingRight =
        columnsTotalSize -
        rightNonPinnedEnd -
        (sizePinnedRight ? columnsTotalSize - rightNonPinnedStart : 0)
    }
  }

  return {
    '--virtual-padding-left': `${virtualPaddingLeft}px`,
    '--virtual-padding-right': `${virtualPaddingRight}px`,
    '--virtual-padding-right-display':
      virtualPaddingRight > 0 ? 'flex' : 'none',
    '--virtual-padding-left-display': virtualPaddingLeft > 0 ? 'flex' : 'none',
  } as CSSProperties
}
