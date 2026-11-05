/**
 * Стандартный набор функций агрегации TanStack: общий у модели группировки и итогов колонок
 * (ADR 0184). Один объект — плагины вместе не перезаписывают опции друг друга.
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
  rowAggregationFeature,
} from '@tanstack/react-table'

export const aggregationFns = {
  sum: aggregationFn_sum,
  count: aggregationFn_count,
  min: aggregationFn_min,
  max: aggregationFn_max,
  extent: aggregationFn_extent,
  mean: aggregationFn_mean,
  median: aggregationFn_median,
  unique: aggregationFn_unique,
}

/** Фичи агрегации таблицы. */
export const aggregationFeatures = { rowAggregationFeature, aggregationFns }
