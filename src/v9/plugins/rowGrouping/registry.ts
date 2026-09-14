/**
 * Фаза E — запись плагина rowGrouping для v9 (порт registry.ts, ADR 0016).
 *
 * Отличия от v8:
 *  - поведение даёт `columnGroupingFeature` + слот `groupedRowModel`; агрегация в v9
 *    ОТДЕЛЕНА от группировки — добавляем `rowAggregationFeature` + стандартный набор
 *    `aggregationFns` (в v8 агрегаты шли внутри getGroupedRowModel);
 *  - имена опций (enableGrouping/groupedColumnMode) совпали с v8.
 */
import {
  aggregationFn_count,
  aggregationFn_extent,
  aggregationFn_max,
  aggregationFn_mean,
  aggregationFn_median,
  aggregationFn_min,
  aggregationFn_sum,
  aggregationFn_unique,
  columnGroupingFeature,
  createGroupedRowModel,
  rowAggregationFeature,
} from '@tanstack/table-v9'

import type { TesseraFeatureEntry } from '../../core/features'
import { groupHeaderAction } from './groupHeaderAction'

/** Стандартный набор агрегаций (паритет со встроенными v8). */
const aggregationFns = {
  sum: aggregationFn_sum,
  count: aggregationFn_count,
  min: aggregationFn_min,
  max: aggregationFn_max,
  extent: aggregationFn_extent,
  mean: aggregationFn_mean,
  median: aggregationFn_median,
  unique: aggregationFn_unique,
}

export interface RowGroupingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const rowGrouping = (opts: RowGroupingOptions = {}) =>
  ({
    id: 'rowGrouping',
    enabled: opts.enabled,
    slot: {
      columnGroupingFeature,
      rowAggregationFeature,
      groupedRowModel: createGroupedRowModel(),
      aggregationFns,
    },
    // Единый дескриптор (ADR 0016): ядро решает подачу (инлайн-кнопка / строка меню).
    slotActions: [groupHeaderAction],
    options: {
      enableGrouping: opts.enabled !== false,
      groupedColumnMode: false,
    },
  }) satisfies TesseraFeatureEntry<{
    columnGroupingFeature: typeof columnGroupingFeature
    rowAggregationFeature: typeof rowAggregationFeature
    groupedRowModel: ReturnType<typeof createGroupedRowModel>
    aggregationFns: typeof aggregationFns
  }>
