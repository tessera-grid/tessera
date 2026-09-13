import type { CSSProperties } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'

import type { Table } from '../../types'

interface ColumnVirtualizerScrollParams {
  table: Table<any, any>
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

  const startVisibleColumns = table.getStartVisibleLeafColumns()
  const endVisibleColumns = table.getEndVisibleLeafColumns()

  const [startPinnedIndexes, endPinnedIndexes] = [
    startVisibleColumns.map((c: any) => c.getPinnedIndex()),
    endVisibleColumns
      .map((column: any) => visibleColumnsCount - column.getPinnedIndex() - 1)
      .sort((a: number, b: number) => a - b),
  ]

  const sizePinnedStart = startPinnedIndexes.length
  const sizePinnedEnd = endPinnedIndexes.length
  const sizeColumns = virtualColumns.length

  let virtualPaddingLeft = 0
  let virtualPaddingRight = 0

  if (virtualColumns.length) {
    if (sizeColumns) {
      const startNonPinnedStart = virtualColumns[sizePinnedStart]?.start || 0
      const startNonPinnedEnd =
        virtualColumns[startPinnedIndexes.length - 1]?.end || 0

      const endNonPinnedStart =
        virtualColumns[sizeColumns - sizePinnedEnd]?.start || 0
      const endNonPinnedEnd =
        virtualColumns[sizeColumns - sizePinnedEnd - 1]?.end || 0

      virtualPaddingLeft = startNonPinnedStart - startNonPinnedEnd

      virtualPaddingRight =
        columnsTotalSize -
        endNonPinnedEnd -
        (sizePinnedEnd ? columnsTotalSize - endNonPinnedStart : 0)
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
