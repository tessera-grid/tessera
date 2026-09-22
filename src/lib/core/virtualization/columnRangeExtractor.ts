import { useCallback } from 'react'

import { type Range, defaultRangeExtractor } from '@tanstack/react-virtual'

import type { Table } from '../../types'
import { useActiveCellIndex } from '../keyboardNavigation'
import { useSlice } from '../reactivity'

export interface UseColumnRangeExtractorParams {
  table: Table<any, any>
}

/**
 * Динамический диапазон индексов колонок для виртуализации.
 * @link https://tanstack.com/virtual/latest/docs/api/virtualizer#rangeextractor
 */
export const useColumnRangeExtractor = ({
  table,
}: UseColumnRangeExtractorParams) => {
  // react-virtual мемоизирует `getIndexes` по паре `[range, rangeExtractor]`.
  // При скролле меняется `range`, но закрепление столбца `range` не двигает, а
  // ссылка на extractor стабильна (deps = [table]) — поэтому только что
  // закреплённый столбец не попадал бы в окно до следующего скролла. Кладём
  // `columnPinning` в deps: при смене закрепления идентичность extractor меняется,
  // react-virtual сбрасывает кэш и пере-считает окно сразу (прибивая пиннутый).
  const columnPinning = useSlice(table, 'columnPinning')
  // Активная колонка клавиатурной навигации держится в окне (фокус не размонтируется).
  const activeColumnIndex = useActiveCellIndex(table, 'columnIndex')

  return useCallback(
    (range: Range) => {
      const newIndexes = defaultRangeExtractor(range)
      const activeIndexes =
        activeColumnIndex !== undefined && activeColumnIndex < range.count
          ? [activeColumnIndex]
          : []

      if (!table.getIsSomeColumnsPinned()) {
        return activeIndexes.length === 0
          ? newIndexes
          : Array.from(new Set([...activeIndexes, ...newIndexes])).sort(
              (a, b) => a - b,
            )
      }

      const visibleColumns = table.getVisibleLeafColumns()

      const startPinnedIndexes = table
        .getStartVisibleLeafColumns()
        .map((c: any) => c.getPinnedIndex())

      const endPinnedIndexes = table
        .getEndVisibleLeafColumns()
        .map(
          (column: any) => visibleColumns.length - column.getPinnedIndex() - 1,
        )
        .sort((a: number, b: number) => a - b)

      return Array.from(
        new Set([
          ...startPinnedIndexes,
          ...newIndexes,
          ...activeIndexes,
          ...endPinnedIndexes,
        ]),
      ).sort((a, b) => a - b)
    },
    // `columnPinning` не читается в теле напрямую (пиннинг берётся через `table`),
    // но обязан быть в deps: смена идентичности extractor заставляет react-virtual
    // пере-считать окно сразу при закреплении, а не со следующего скролла.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, columnPinning, activeColumnIndex],
  )
}
