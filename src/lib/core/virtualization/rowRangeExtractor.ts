import { useCallback } from 'react'

import type { Range } from '../../../vendor/tanstack-virtual/react-virtual'

import type { WindowBand } from './windowBand'

export interface UseRowRangeExtractorParams {
  /** Полоса окна строк (ADR 0202). */
  band: WindowBand
  rowDraggingIndex?: number
  /** Активная строка клавиатурной навигации (фокус не должен размонтироваться). */
  activeRowIndex?: number
  /** Строка активной ячейки после смены списка, пока ячейка не переехала за ней. */
  heldRowIndex?: number
}

/**
 * Динамический диапазон индексов строк для виртуализации: перетаскиваемая и
 * активная (клавиатурный фокус) строки держатся в окне даже вне видимой области.
 * @link https://tanstack.com/virtual/latest/docs/api/virtualizer#rangeextractor
 */
export const useRowRangeExtractor = ({
  band,
  rowDraggingIndex,
  activeRowIndex,
  heldRowIndex,
}: UseRowRangeExtractorParams) => {
  return useCallback(
    (range: Range) => {
      const newIndexes = band(range)
      const pinned = [rowDraggingIndex, activeRowIndex, heldRowIndex].filter(
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
    [band, rowDraggingIndex, activeRowIndex, heldRowIndex],
  )
}
