import { memo } from 'react'

import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { CellComponentProps } from '../types'
import { DragHandler } from '../ui'

export const RowDraggingComponent = memo(({ row }: CellComponentProps) => {
  useSubscribeStore(() => [row.getCanDrag()])

  if (!row.getCanDrag()) {
    return null
  }

  return <DragHandler id={row.id} type="row" />
})

RowDraggingComponent.displayName = 'RowDraggingComponent'
