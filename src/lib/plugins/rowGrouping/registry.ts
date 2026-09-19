/**
 * Запись плагина rowGrouping (ADR 0016). Поведение даёт `columnGroupingFeature` +
 * слот `groupedRowModel`; агрегация отделена от группировки — добавляем
 * `rowAggregationFeature` + стандартный набор `aggregationFns`.
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
} from '@tanstack/react-table'

import type { TesseraFeatureEntry } from '../../core/features'
import { groupHeaderAction } from './groupHeaderAction'

/** Стандартный набор агрегаций. */
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
