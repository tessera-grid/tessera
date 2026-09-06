import { MouseEvent, memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { HeaderComponentProps } from '../types'
import { SortButton } from './SortButton'

export const ColumnSortingComponent = memo(
  ({ column, table }: HeaderComponentProps) => {
    useSubscribeStore(() => [
      column.getIsSorted(),
      column.getNextSortingOrder(),
      column.getCanSort(),
      column.getSortIndex(),
      table.getState().sorting.length,
      table.options.enableSorting,
      table.options.enableSortingRemoval,
    ])

    if (!column.getCanSort()) {
      return null
    }

    const operation = column.getIsSorted()
    const nextOperation = column.getNextSortingOrder()

    // Индикатор приоритета — только при 2+ отсортированных столбцах.
    const sortCount = table.getState().sorting.length
    const sortIndex = column.getSortIndex()
    const isMultiSorted = sortCount > 1 && sortIndex >= 0

    const onSort = (event: MouseEvent<HTMLButtonElement>) => {
      const { onToggleColumnSort } = table.getHooks().columnSorting

      column.getToggleSortingHandler()?.(event)
      onToggleColumnSort(column.id, nextOperation)
    }

    return (
      <SortButton
        operation={operation}
        nextOperation={nextOperation}
        sortIndex={isMultiSorted ? sortIndex : undefined}
        sortCount={sortCount}
        onClick={onSort}
      />
    )
  },
)
