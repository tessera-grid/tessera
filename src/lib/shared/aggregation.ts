/**
 * Стандартный набор функций агрегации TanStack: общий у модели группировки и итогов колонок
 * (ADR 0184). Один объект — плагины вместе не перезаписывают опции друг друга. Поле колонки
 * `aggregationScope` (ADR 0229) читают итог колонок, модель группировки и серверная модель.
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

import type { RowData, TableFeature, TableFeatures } from '../types'

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

/** Поле колонки `aggregationScope` — фича без поведения, только поле в карте фич. */
export const aggregationScopeFeature: TableFeature = {}

export type AggregationScope = 'top' | 'all'

export interface AggregationScopeColumnDef {
  /**
   * Строки дерева, которые складывает агрегат колонки (ADR 0229): `'top'` — верхний уровень
   * (умолчание), `'all'` — все строки с потомками; `maxAggregationDepth` тогда не действует.
   */
  aggregationScope?: AggregationScope
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    aggregationScopeFeature: TableFeature
  }
  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    in out TValue,
  > {
    aggregationScopeFeature: AggregationScopeColumnDef
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

/** Фичи агрегации таблицы. */
export const aggregationFeatures = {
  rowAggregationFeature,
  aggregationScopeFeature,
  aggregationFns,
}

/** Колонка складывает все строки дерева. */
export const aggregatesAllNodes = (columnDef: unknown) =>
  (columnDef as AggregationScopeColumnDef | undefined)?.aggregationScope ===
  'all'

/** Таблица с ленивыми детьми: часть строк дерева не загружена (ADR 0229, §5). */
export const hasLazyChildren = (table: unknown) =>
  !!(
    table as {
      getHooks?: () => { rowExpanding?: { loadChildren?: unknown } } | undefined
    }
  ).getHooks?.()?.rowExpanding?.loadChildren

/** Строки и все их потомки по порядку дерева. */
export const withDescendants = <TRow>(
  rows: readonly TRow[],
  childrenOf: (row: TRow) => readonly TRow[],
): TRow[] => {
  const result: TRow[] = []
  const visit = (row: TRow) => {
    result.push(row)
    for (const child of childrenOf(row)) visit(child)
  }
  for (const row of rows) visit(row)
  return result
}
