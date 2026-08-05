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
      table.options.enableSorting,
      table.options.enableSortingRemoval,
    ])

    if (!column.getCanSort()) {
      return null
    }

    const operation = column.getIsSorted()
    const nextOperation = column.getNextSortingOrder()

    const onSort = (event: MouseEvent<HTMLButtonElement>) => {
      const { onToggleColumnSort } = table.getHooks().columnSorting

      column.getToggleSortingHandler()?.(event)
      onToggleColumnSort(column.id, nextOperation)
    }

    return (
      <SortButton
        operation={operation}
        nextOperation={nextOperation}
        onClick={onSort}
      />
    )
  },
)
