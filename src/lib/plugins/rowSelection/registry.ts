/**
 * Запись плагина rowSelection (ADR 0014/0022). Поведение даёт встроенный
 * `rowSelectionFeature` (row-модель не нужна).
 *  - гейт группировки (ADR 0022) — через функциональный `enableRowSelection` (влияет
 *    и на агрегаты getIsAll/SomePageRowsSelected);
 *  - `enableRowRangeSelection: false` — гасим shift-range (клик по чекбоксу не должен
 *    диапазонно выделять).
 */
import { rowSelectionFeature } from '@tanstack/react-table'

import type { Row } from '../../types'
import type { ServiceColumn } from '../../core/createColumns'
import type { TesseraFeatureEntry } from '../../core/features'
import {
  COLUMN_SELECTION_ID,
  getRowSelectionColumn,
} from './rowSelectionColumn'
import { isGroupingActive } from './selectionHelpers'
import type { RowSelectionPluginParams } from './types'

export interface RowSelectionOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить выбор дочерних строк (каскад на поддерево). */
  subRows?: boolean
  /**
   * Бизнес-колбэки плагина, задаются прямо в аргументах фабрики. Читаются живо через
   * `table.getHooks()` (замена верхнего параметра `hooks`, прототип). Частичный набор
   * дополняется no-op дефолтами.
   */
  onSelectRow?: RowSelectionPluginParams['onSelectRow']
  onSelectAllRowsOnPage?: RowSelectionPluginParams['onSelectAllRowsOnPage']
  isAllRowsSelected?: RowSelectionPluginParams['isAllRowsSelected']
}

export const rowSelection = (opts: RowSelectionOptions = {}) => {
  /**
   * Выбор недоступен при АКТИВНОЙ группировке (ADR 0022): сгруппированная модель
   * производна, выбором владеет rowGrouping. Функциональный `enableRowSelection`
   * согласует и агрегаты (getIsAllPageRowsSelected и т.п.).
   */
  const enableRowSelection = (row: Row<any, any>): boolean =>
    !isGroupingActive(row.table)

  // Слайс бизнес-хуков из аргументов фабрики (только заданные ключи — остальные
  // дополнит resolveHooks no-op дефолтами).
  const hookSlice: Partial<RowSelectionPluginParams> = {}
  if (opts.onSelectRow) {
    hookSlice.onSelectRow = opts.onSelectRow
  }
  if (opts.onSelectAllRowsOnPage) {
    hookSlice.onSelectAllRowsOnPage = opts.onSelectAllRowsOnPage
  }
  if (opts.isAllRowsSelected !== undefined) {
    hookSlice.isAllRowsSelected = opts.isAllRowsSelected
  }

  return {
    id: 'rowSelection',
    enabled: opts.enabled,
    slot: {
      rowSelectionFeature,
    },
    hooks: { rowSelection: hookSlice },
    column: {
      id: COLUMN_SELECTION_ID,
      make: getRowSelectionColumn,
      side: 'leading',
      order: 1,
      pin: { side: 'start', when: 'with-user' },
    } satisfies ServiceColumn,
    options: {
      // При disabled — жёстко false (иначе present-but-disabled фича активна:
      // v9 фиксирует набор фич на маунте, гейт рантайм-тоггла — опцией).
      enableRowSelection: opts.enabled === false ? false : enableRowSelection,
      enableSubRowSelection: opts.subRows ?? false,
      enableRowRangeSelection: false,
    },
  } satisfies TesseraFeatureEntry<{
    rowSelectionFeature: typeof rowSelectionFeature
  }>
}
