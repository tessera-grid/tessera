import { useCallback, useState } from 'react'

import type { Range } from '../../../vendor/tanstack-virtual/react-virtual'

import { createWindowBand, useBandRest } from './windowBand'
import { isIncremental } from './windowPortions'

import type { Table } from '../../types'
import { useMeasuringColumns } from '../autosize'
import { useActiveCellIndex } from '../keyboardNavigation'
import { useSlice } from '../reactivity'
import { useLatest } from '../../util/useLatest'

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
  // react-virtual мемоизирует `getIndexes` по паре `[range, rangeExtractor]`: новый
  // extractor — новый массив колонок окна и перерисовка всех строк (ADR 0099, PF5).
  // Поэтому зависимость — хранилище таблицы, а не `table`: `useTable` отдаёт новую
  // копию экземпляра при каждой смене состояния.
  // При скролле меняется `range`, но закрепление столбца `range` не двигает, а
  // ссылка на extractor стабильна — поэтому только что
  // закреплённый столбец не попадал бы в окно до следующего скролла. Кладём
  // `columnPinning` в deps: при смене закрепления идентичность extractor меняется,
  // react-virtual сбрасывает кэш и пере-считает окно сразу (прибивая пиннутый).
  const columnPinning = useSlice(table, 'columnPinning')
  // Активная колонка клавиатурной навигации держится в окне (фокус не размонтируется).
  const activeColumnIndex = useActiveCellIndex(table, 'columnIndex')
  const latest = useLatest(table)
  // Колонки автоподбора ширины вне окна — отрисованы на время замера (ADR 0217, §1).
  const measuring = useMeasuringColumns(table)

  // Полоса окна (ADR 0202, §1): своя у каждого виртуализатора; смена списка строк — покой (§1а).
  const [band] = useState(createWindowBand)
  const rows = table.getRowSource()
  const bandVersion = useBandRest(
    band,
    rows.keyByIndex ? rows.version?.() : rows.rows?.(),
    isIncremental(table),
  )

  return useCallback(
    (range: Range) => {
      const table = latest.current
      const banded = band(range)
      const newIndexes =
        measuring.size === 0
          ? banded
          : Array.from(
              new Set([
                ...banded,
                ...table
                  .getVisibleLeafColumns()
                  .flatMap((column: { id: string }, index: number) =>
                    measuring.has(column.id) ? [index] : [],
                  ),
              ]),
            ).sort((a, b) => a - b)
      const activeIndexes =
        activeColumnIndex !== undefined &&
        activeColumnIndex >= 0 &&
        activeColumnIndex < range.count
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
    // Версия полосы тоже не читается, но пересобирает окно при покое и росте.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      band,
      latest,
      table.store,
      columnPinning,
      activeColumnIndex,
      bandVersion,
      measuring,
    ],
  )
}
