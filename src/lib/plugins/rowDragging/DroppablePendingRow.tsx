/**
 * Декоратор незагруженной строки серверной модели (ADR 0168, §2): место dnd-kit без строки,
 * бросок на него недоступен (ADR 0159, §3).
 */
import { memo } from 'react'

import { useDroppable } from '@dnd-kit/core'

import type { PendingRowDecoratorProps } from '../../core/pluginWrappers'

/** Незагруженная строка под указателем перетаскивания: бросок недоступен. */
export interface PendingDropData {
  pending: true
  virtualIndex: number
}

export const DroppablePendingRow = memo(
  ({ Row, ...props }: PendingRowDecoratorProps) => {
    const { setNodeRef } = useDroppable({
      id: `pending:${props.virtualRow.index}`,
      data: {
        pending: true,
        virtualIndex: props.virtualRow.index,
      } satisfies PendingDropData,
    })
    return <Row {...props} drag={{ setNodeRef }} />
  },
)

DroppablePendingRow.displayName = 'DroppablePendingRow'
