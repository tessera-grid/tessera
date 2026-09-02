import { useMemo } from 'react'

import { AccessorKeyColumnDef } from '@tanstack/react-table'

import { ServiceColumn } from '../pluginContract'
import { CreateDataGridParams } from '../createTable/types'
import { getMaxColumnsDepth } from './getMaxColumnsDepth'

export interface UseCreateColumnsParams<
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
> {
  initialColumns: CreateDataGridParams<
    TData,
    THooks,
    TState,
    TOptions
  >['columns']
  /**
   * Сервисные колонки, принесённые плагинами (и ядром — напр. колонка действий).
   * Ядро не знает конкретных плагинов: размещение задаёт `side`, порядок — `order`
   * (при равенстве — позиция в списке; сортировка стабильна). См. ADR 0010.
   */
  pluginColumns: ServiceColumn[]
}

// TODO: переделать на Set будет проще?
const deduplicateColumns = <
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
>(
  columns: CreateDataGridParams<TData, THooks, TState, TOptions>['columns'],
): CreateDataGridParams<TData, THooks, TState, TOptions>['columns'] => {
  const columnsMap = columns.reduce((acc, col) => {
    return acc.set(col.id, col)
  }, new Map())

  return Array.from(columnsMap.values())
}

const bySide = (side: ServiceColumn['side']) => (a: ServiceColumn) =>
  a.side === side

const byOrder = (a: ServiceColumn, b: ServiceColumn) => a.order - b.order

export const useCreateColumns = <
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
>({
  initialColumns,
  pluginColumns,
}: UseCreateColumnsParams<TData, THooks, TState, TOptions>) => {
  return useMemo(() => {
    if (initialColumns.length === 0) {
      return []
    }

    const depth = getMaxColumnsDepth(initialColumns)

    const leading = pluginColumns.filter(bySide('leading')).sort(byOrder)
    const trailing = pluginColumns.filter(bySide('trailing')).sort(byOrder)

    const make = (column: ServiceColumn) =>
      column.make(depth) as AccessorKeyColumnDef<
        TData,
        unknown,
        THooks,
        TState,
        TOptions
      >

    return deduplicateColumns([
      ...leading.map(make),
      ...initialColumns,
      ...trailing.map(make),
    ])
  }, [initialColumns, pluginColumns])
}
