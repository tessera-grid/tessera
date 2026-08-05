import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore'
import { HeaderComponentProps } from '../types'
import { DragHandler } from '../ui'

export const ColumnDraggingComponent = memo(
  ({ column, table }: HeaderComponentProps) => {
    useSubscribeStore(() => [
      column.getCanDrag(),
      column.getCanPin(),
      table.options.enableColumnDragging,
    ])

    if (!column.getCanDrag()) {
      return null
    }

    return (
      <DragHandler
        id={column.id}
        type="column"
        disabled={column.getIsPinned() !== false}
      />
    )
  },
)
