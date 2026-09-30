/** Типы плагина columnDragging. */
import type { UniqueIdentifier } from '@dnd-kit/core'

import type { SessionCancelReason } from '../../core/cancelInteraction'

export type DragOverlayState = UniqueIdentifier | null

export interface ColumnDraggingState {
  columnDraggingActiveId: DragOverlayState
}

export interface ColumnDraggingHooks {
  onColumnDragEnd: (props: { dragIndex: number; hoverIndex: number }) => void
  /** Перетаскивание завершилось без перестановки (ADR 0040, §1). */
  onColumnDragCancel?: (end: {
    columnId: string
    reason: SessionCancelReason
  }) => void
}
