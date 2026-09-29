/**
 * Запись плагина rowGrouping на `definePlugin`. Поведение даёт
 * `columnGroupingFeature` + `groupedRowModel`; агрегация отделена от группировки —
 * добавляем `rowAggregationFeature` + стандартный набор `aggregationFns`.
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

import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
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

export const rowGrouping = definePlugin<RowGroupingOptions>()({
  id: 'rowGrouping',
  diagnose: neverInert,
  features: {
    columnGroupingFeature,
    rowAggregationFeature,
    groupedRowModel: createGroupedRowModel(),
    aggregationFns,
  },
  // Единый дескриптор: ядро решает подачу (инлайн-кнопка / строка меню).
  slotActions: [groupHeaderAction],
  options: o => ({
    enableGrouping: o.enabled !== false,
    groupedColumnMode: false,
  }),
})
