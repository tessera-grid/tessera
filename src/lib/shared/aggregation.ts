/**
 * Стандартный набор функций агрегации TanStack: общий у модели группировки и итогов колонок
 * (ADR 0184). Один объект — плагины вместе не перезаписывают опции друг друга. Поле колонки
 * `aggregationScope` (ADR 0229) читают итог колонок, модель группировки и серверная модель;
 * выбор функции пользователем (ADR 0230) — модель группировки по ключу `aggregationChoiceOf`.
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
  constructAggregationFn,
  rowAggregationFeature,
} from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../types'

/** Число разных значений колонки (ADR 0230, §2): строки без значения не считаются. */
export const aggregationFn_uniqueCount = constructAggregationFn({
  aggregate: context => {
    const values = new Set<unknown>()
    for (const row of context.rows) {
      const value = context.getValue(row)
      if (value !== undefined && value !== null && value !== '') {
        values.add(value instanceof Date ? value.getTime() : value)
      }
    }
    return values.size
  },
})

export const aggregationFns = {
  sum: aggregationFn_sum,
  count: aggregationFn_count,
  min: aggregationFn_min,
  max: aggregationFn_max,
  extent: aggregationFn_extent,
  mean: aggregationFn_mean,
  median: aggregationFn_median,
  unique: aggregationFn_unique,
  uniqueCount: aggregationFn_uniqueCount,
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

/**
 * Выбор функций колонок пользователем (ADR 0230, §1): ссылка среза — ключ, по которому модель
 * группировки пересчитывает значения строк-групп. Без плагина сводки — `undefined`.
 */
export const aggregationChoiceOf = (table: unknown): unknown =>
  (
    table as {
      atoms?: { columnAggregations?: { get: () => unknown } }
    }
  ).atoms?.columnAggregations?.get()

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
