import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { HeaderComponentProps } from '../types'
import { ResizeHandler } from './ResizeHandler'

export const ColumnSizingComponent = memo(
  ({ header, column, table }: HeaderComponentProps) => {
    useSubscribeStore(() => [
      column.getIsResizing(),
      column.getCanResize(),
      table.options.enableColumnResizing,
    ])

    if (!column.getCanResize()) {
      return
    }

    const onResetSize = () => {
      const { onColumnResizeEnd } = table.getHooks().columnSizing
      const defaultSize = table.options.defaultColumn?.size || 150

      column.resetSize()

      onColumnResizeEnd?.({
        id: column.id,
        width: defaultSize,
      })
    }

    const onResizeEnd = () => {
      const { onColumnResizeEnd } = table.getHooks().columnSizing
      const size = column.getSize()

      onColumnResizeEnd?.({
        id: column.id,
        width: size,
      })
    }

    return (
      <ResizeHandler
        isResizing={column.getIsResizing()}
        onResize={header.getResizeHandler()}
        onResizeEnd={onResizeEnd}
        onResetSize={onResetSize}
      />
    )
  },
)
