/** Типы плагина columnDragging. */
import type { SessionCancelReason } from '../../core/cancelInteraction'
import type { DragOverlayState } from '../../shared/dragOverlay'

export type { DragOverlayState }

export interface ColumnDraggingState {
  columnDraggingActiveId: DragOverlayState
}

export interface ColumnDraggingHooks {
  /**
   * A column was moved; a promise shows pending on the handle, a rejection returns the column
   * to its previous neighbors (ADR 0114).
   */
  onColumnDragEnd: (props: {
    /** Index among draggable leaves; for a group — that of its first leaf. */
    dragIndex: number
    hoverIndex: number
    /** The moved node — a leaf or a group (ADR 0052). */
    columnId: string
    /** The new leaf order. */
    columnOrder: string[]
  }) => void | PromiseLike<unknown>
  /** The drag ended without reordering (ADR 0040, §1). */
  onColumnDragCancel?: (end: {
    columnId: string
    reason: SessionCancelReason
  }) => void
}
