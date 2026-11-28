/**
 * Запись плагина columnSortingModel на `definePlugin`: модель сортировки без интерфейса
 * (ADR 0120). Строки упорядочены по срезу `sorting`; кнопки в заголовках, клавиша и
 * колбэк пользователя — у `columnSorting`, который включает эту модель.
 */
import {
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_alphanumericCaseSensitive,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  sortFn_textCaseSensitive,
  type SortingState,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { narrowSorting } from './narrowSorting'
import { optionLabelSortFeature } from './optionLabelSort'
import { typedSortFeature } from './typedSort'
import { createTesseraSortedRowModel } from './sortedRowModel'
import { ownStage } from '../../core/rowEngine/engine'

export interface ColumnSortingModelOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /**
   * Multi-sort: `true`/`undefined` — no limit; `false` — one column; `{ max }` — no more than
   * `max` columns in the slice.
   */
  multiSort?: boolean | { max?: number }
  /** Sort order set by the application; without it the grid keeps the slice. */
  sorting?: SortingState
  /** New slice value after each change from inside the grid. */
  onSortingChange?: (next: SortingState) => void
  /** Initial value of the slice the grid owns. */
  initialSorting?: SortingState
}

/** The standard set of sort functions. */
const sortFns = {
  alphanumeric: sortFn_alphanumeric,
  alphanumericCaseSensitive: sortFn_alphanumericCaseSensitive,
  text: sortFn_text,
  textCaseSensitive: sortFn_textCaseSensitive,
  datetime: sortFn_datetime,
  basic: sortFn_basic,
}

/** Фичи модели сортировки; интерфейс несёт те же — по ним выводится тип среза. */
export const sortingModelFeatures = {
  rowSortingFeature,
  optionLabelSortFeature,
  typedSortFeature,
  sortedRowModel: ownStage('sort', createTesseraSortedRowModel()),
  sortFns,
}

/** Предел столбцов сортировки по `multiSort`; `undefined` — без предела. */
export const multiSortLimit = (
  multiSort: ColumnSortingModelOptions['multiSort'],
): number | undefined =>
  multiSort === false
    ? 1
    : typeof multiSort === 'object'
      ? multiSort.max
      : undefined

export const columnSortingModel = definePlugin<ColumnSortingModelOptions>()({
  id: 'columnSortingModel',
  diagnose: neverInert,
  features: sortingModelFeatures,
  slices: ['sorting'],
  narrow: o => {
    if (o.enabled === false) {
      return undefined
    }
    const limit = multiSortLimit(o.multiSort)
    return limit === undefined ? undefined : { sorting: narrowSorting(limit) }
  },
  options: o => ({
    enableSorting: o.enabled !== false,
  }),
})
