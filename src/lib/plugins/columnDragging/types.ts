/** Типы плагина columnDragging. */
import type { UniqueIdentifier } from '@dnd-kit/core'

export type DragOverlayState = UniqueIdentifier | null

export interface ColumnDraggingState {
  columnDraggingActiveId: DragOverlayState
}

export interface ColumnDraggingHooks {
  onColumnDragEnd: (props: { dragIndex: number; hoverIndex: number }) => void
}
