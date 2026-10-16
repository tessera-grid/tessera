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
import { createTesseraSortedRowModel } from './sortedRowModel'

export interface ColumnSortingModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Серверная сортировка — v9 `manualSorting`: `data` уже упорядочены (по умолчанию false). */
  server?: boolean
  /**
   * Мультисортировка: `true`/`undefined` — без предела; `false` — один столбец;
   * `{ max }` — не больше `max` столбцов в срезе.
   */
  multiSort?: boolean | { max?: number }
  /** Порядок сортировки: задаёт приложение; без него срез хранит грид. */
  sorting?: SortingState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onSortingChange?: (next: SortingState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialSorting?: SortingState
}

/** Стандартный набор функций сортировки. */
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
  sortedRowModel: createTesseraSortedRowModel(),
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
  // Режим данных — договор с потребителем на время жизни таблицы (ADR 0039).
  lifetime: ['server'],
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
    manualSorting: o.server ?? false,
  }),
})
