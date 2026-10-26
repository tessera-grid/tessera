import { useCallback } from 'react'

import {
  type Range,
  defaultRangeExtractor,
} from '../../../vendor/tanstack-virtual/react-virtual'

export interface UseRowRangeExtractorParams {
  rowDraggingIndex?: number
  /** Активная строка клавиатурной навигации (фокус не должен размонтироваться). */
  activeRowIndex?: number
}

/**
 * Динамический диапазон индексов строк для виртуализации: перетаскиваемая и
 * активная (клавиатурный фокус) строки держатся в окне даже вне видимой области.
 * @link https://tanstack.com/virtual/latest/docs/api/virtualizer#rangeextractor
 */
export const useRowRangeExtractor = ({
  rowDraggingIndex,
  activeRowIndex,
}: UseRowRangeExtractorParams) => {
  return useCallback(
    (range: Range) => {
      const newIndexes = defaultRangeExtractor(range)
      const pinned = [rowDraggingIndex, activeRowIndex].filter(
        (index): index is number =>
          index !== undefined && index >= 0 && index < range.count,
      )

      if (pinned.length === 0) {
        return newIndexes
      }

      return Array.from(new Set([...pinned, ...newIndexes])).sort(
        (a, b) => a - b,
      )
    },
    [rowDraggingIndex, activeRowIndex],
  )
}
