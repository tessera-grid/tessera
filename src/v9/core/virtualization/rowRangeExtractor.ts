import { useCallback } from 'react'

import { type Range, defaultRangeExtractor } from '@tanstack/react-virtual'

export interface UseRowRangeExtractorParams {
  rowDraggingIndex?: number
}

/**
 * Динамический диапазон индексов строк для виртуализации: перетаскиваемая строка
 * держится в окне даже вне видимой области.
 * @link https://tanstack.com/virtual/latest/docs/api/virtualizer#rangeextractor
 */
export const useRowRangeExtractor = ({
  rowDraggingIndex,
}: UseRowRangeExtractorParams) => {
  return useCallback(
    (range: Range) => {
      const newIndexes = defaultRangeExtractor(range)

      if (rowDraggingIndex !== undefined) {
        return Array.from(new Set([rowDraggingIndex, ...newIndexes])).sort(
          (a, b) => a - b,
        )
      }

      return newIndexes
    },
    [rowDraggingIndex],
  )
}
