/**
 * Запись плагина rowGroupingModel на `definePlugin`: модель группировки без интерфейса
 * (ADR 0016, ADR 0120). Строки сгруппированы по срезу `grouping`, агрегация — стандартным
 * набором; группы раскрываются моделью дерева `rowExpandingModel`, которую эта модель
 * включает. Кнопка группировки в заголовке — у `rowGrouping`.
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
  type GroupingState,
  rowAggregationFeature,
} from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { neverInert } from '../../core/pluginDiagnostics'
import { rowExpandingModel } from '../rowExpandingModel/registry'
import { createIdleAwareGroupedRowModel } from './groupedRowModel'

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

export interface RowGroupingModelOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Колонки группировки по порядку: задаёт приложение; без него срез хранит грид. */
  grouping?: GroupingState
  /** Новое значение среза после каждого изменения изнутри грида. */
  onGroupingChange?: (next: GroupingState) => void
  /** Начальное значение среза, которым владеет грид. */
  initialGrouping?: GroupingState
}

/** Фичи модели группировки; интерфейс несёт те же — по ним выводится тип среза. */
export const rowGroupingModelFeatures = {
  columnGroupingFeature,
  rowAggregationFeature,
  groupedRowModel: createIdleAwareGroupedRowModel(),
  aggregationFns,
}

export const rowGroupingModel = definePlugin<RowGroupingModelOptions>()({
  id: 'rowGroupingModel',
  diagnose: neverInert,
  // Группы раскрывает модель дерева; её срез `expanded` — её аргумент (MP10).
  model: { plugin: rowExpandingModel, keys: [] },
  features: rowGroupingModelFeatures,
  slices: ['grouping'],
  options: o => ({
    enableGrouping: o.enabled !== false,
    groupedColumnMode: false,
  }),
})
