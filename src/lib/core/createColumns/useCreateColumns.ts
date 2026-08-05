import { useMemo } from 'react'

import { AccessorKeyColumnDef, TableOptions } from '@tanstack/react-table'

import { getRowDraggingColumn } from '../../plugins/rowDragging'
import { getRowExpandingColumn } from '../../plugins/rowExpanding'
import { getRowSelectionColumn } from '../../plugins/rowSelection'
import { CreateDataGridParams } from '../createTable/types'
import { getRowActionsColumn } from './createRowActionsColumn'
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
  enableRowSelection: TableOptions<TData>['enableRowSelection']
  enableRowExpanding: TableOptions<TData>['enableRowExpanding']
  enableRowDragging: TableOptions<TData>['enableRowDragging']
  enableRowActions: TableOptions<TData>['enableRowActions']
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

export const useCreateColumns = <
  TData = any,
  THooks = any,
  TState = any,
  TOptions = any,
>({
  initialColumns,
  enableRowSelection,
  enableRowExpanding,
  enableRowDragging,
  enableRowActions,
}: UseCreateColumnsParams<TData, THooks, TState, TOptions>) => {
  const maxDepthColumns = useMemo(
    () => getMaxColumnsDepth(initialColumns),
    [initialColumns],
  )

  const rowSelectionColumn = useMemo(
    () => getRowSelectionColumn(maxDepthColumns),
    [maxDepthColumns],
  )
  const rowExpandingColumn = useMemo(
    () => getRowExpandingColumn(maxDepthColumns),
    [maxDepthColumns],
  )
  const rowDraggingColumn = useMemo(
    () => getRowDraggingColumn(maxDepthColumns),
    [maxDepthColumns],
  )
  const rowActionsColumn = useMemo(
    () => getRowActionsColumn(maxDepthColumns),
    [maxDepthColumns],
  )

  return useMemo(() => {
    if (initialColumns.length === 0) {
      return []
    }

    const temp = [...initialColumns]

    if (enableRowExpanding) {
      temp.unshift(
        rowExpandingColumn as AccessorKeyColumnDef<
          TData,
          unknown,
          THooks,
          TState,
          TOptions
        >,
      )
    }

    if (enableRowSelection) {
      temp.unshift(
        rowSelectionColumn as AccessorKeyColumnDef<
          TData,
          unknown,
          THooks,
          TState,
          TOptions
        >,
      )
    }

    if (enableRowDragging) {
      temp.unshift(
        rowDraggingColumn as AccessorKeyColumnDef<
          TData,
          unknown,
          THooks,
          TState,
          TOptions
        >,
      )
    }

    if (enableRowActions) {
      temp.push(
        rowActionsColumn as AccessorKeyColumnDef<
          TData,
          unknown,
          THooks,
          TState,
          TOptions
        >,
      )
    }

    return deduplicateColumns(temp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialColumns,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    !!enableRowExpanding,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    !!enableRowSelection,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    !!enableRowDragging,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    !!enableRowActions,
  ])
}
