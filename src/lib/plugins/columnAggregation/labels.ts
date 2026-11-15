/** Подписи `columnAggregation` (ADR 0230; ADR 0182, §8): ключи словаря `columnAggregation.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnAggregationLabels {
  /** Пункт меню колонки, раздел «Настроек вида» и действие */
  summary: string
  /** Пункт «без функции»: итог и значения групп пусты */
  noSummary: string
  /** Сумма */
  sum: string
  /** Среднее */
  mean: string
  /** Медиана */
  median: string
  /** Минимум */
  min: string
  /** Максимум */
  max: string
  /** Количество строк */
  count: string
  /** Число разных значений */
  uniqueCount: string
  /** Диапазон «от — до» */
  extent: string
  /** Список разных значений */
  unique: string
  /** Снять сводку колонки в «Настройках вида» */
  removeSummary: (column: string) => string
  /** Сбросить сводку всех колонок в «Настройках вида» */
  resetSummary: string
}

export const columnAggregationLabels = defineLabels<ColumnAggregationLabels>()(
  'columnAggregation',
  {
    summary: 'Summary',
    noSummary: 'No summary',
    sum: 'Sum',
    mean: 'Average',
    median: 'Median',
    min: 'Min',
    max: 'Max',
    count: 'Count',
    uniqueCount: 'Distinct count',
    extent: 'Range',
    unique: 'Distinct values',
    removeSummary: 'Reset summary: {column}',
    resetSummary: 'Reset summary',
  },
  {
    removeSummary: ['column'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnAggregation: typeof columnAggregationLabels
  }
}
