/** Подписи `columnAggregation` (ADR 0230; ADR 0182, §8): ключи словаря `columnAggregation.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnAggregationLabels {
  /** Column menu item, "View settings" section and action */
  summary: string
  /** The "no function" item: the total and group values are empty */
  noSummary: string
  /** Sum */
  sum: string
  /** Average */
  mean: string
  /** Median */
  median: string
  /** Minimum */
  min: string
  /** Maximum */
  max: string
  /** Row count */
  count: string
  /** Number of distinct values */
  uniqueCount: string
  /** "From — to" range */
  extent: string
  /** List of distinct values */
  unique: string
  /** Remove a column's summary in "View settings" */
  removeSummary: (column: string) => string
  /** Reset the summary of all columns in "View settings" */
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
