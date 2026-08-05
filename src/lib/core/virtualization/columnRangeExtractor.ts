import { useCallback } from 'react'

import { Table } from '@tanstack/react-table'
import { Range, defaultRangeExtractor } from '@tanstack/react-virtual'

export interface UseColumnRangeExtractorParams {
  table: Table
}

/**
 * Динамический диапазон индексов колонок для виртуализации
 * @link https://tanstack.com/virtual/latest/docs/api/virtualizer#rangeextractor
 */
export const useColumnRangeExtractor = ({
  table,
}: UseColumnRangeExtractorParams) => {
  return useCallback(
    (range: Range) => {
      const newIndexes = defaultRangeExtractor(range)

      if (!table.getIsSomeColumnsPinned()) {
        return newIndexes
      }

      const visibleColumns = table.getVisibleLeafColumns()

      const leftPinnedIndexes = table
        .getLeftVisibleLeafColumns()
        .map(c => c.getPinnedIndex())

      const rightPinnedIndexes = table
        .getRightVisibleLeafColumns()
        .map(column => visibleColumns.length - column.getPinnedIndex() - 1)
        .sort((a, b) => a - b)

      return Array.from(
        new Set([...leftPinnedIndexes, ...newIndexes, ...rightPinnedIndexes]),
      )
    },
    [table],
  )
}
