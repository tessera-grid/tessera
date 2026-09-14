/**
 * Фаза E — запись плагина rowSelection для v9 (порт registry.ts, ADR 0014/0022).
 *
 * Отличия от v8:
 *  - поведение даёт встроенный `rowSelectionFeature` (row-модель не нужна);
 *  - гейт группировки (ADR 0022) — через функциональный `enableRowSelection`
 *    (в v9 он влияет и на агрегаты getIsAll/SomePageRowsSelected), а не обёрткой
 *    `getCanSelect` в createRow;
 *  - `enableRowRangeSelection: false` — в v9 shift-range стал дефолтом, гасим для
 *    паритета с v8 (клик по чекбоксу не должен диапазонно выделять);
 *  - `keepFeatureWhenDisabled` не нужен (в v9 нет фиксации фич «на маунте»).
 */
import { rowSelectionFeature } from '@tanstack/react-table'

import type { Row } from '../../types'
import type { ServiceColumn } from '../../core/createColumns'
import type { TesseraFeatureEntry } from '../../core/features'
import { COLUMN_SELECTION_ID, getRowSelectionColumn } from './rowSelectionColumn'
import { isGroupingActive } from './selectionHelpers'

export interface RowSelectionOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Разрешить выбор дочерних строк (каскад на поддерево). */
  subRows?: boolean
}

export const rowSelection = (opts: RowSelectionOptions = {}) => {
  /**
   * Выбор недоступен при АКТИВНОЙ группировке (ADR 0022): сгруппированная модель
   * производна, выбором владеет rowGrouping. Функциональный `enableRowSelection`
   * согласует и агрегаты (getIsAllPageRowsSelected и т.п.).
   */
  const enableRowSelection = (row: Row<any, any>): boolean =>
    !isGroupingActive(row.table)

  return {
    id: 'rowSelection',
    enabled: opts.enabled,
    slot: {
      rowSelectionFeature,
    },
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
