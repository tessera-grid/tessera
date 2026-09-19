/** Типы плагина columnDragging. */
import type { UniqueIdentifier } from '@dnd-kit/core'

export type DragOverlayState = UniqueIdentifier | null

export interface ColumnDraggingState {
  columnDraggingActiveId: DragOverlayState
}

export type ColumnDraggingPluginScope = 'columnDragging'

export interface ColumnDraggingPluginParams {
  onColumnDragEnd: (props: { dragIndex: number; hoverIndex: number }) => void
}

export type ColumnDraggingPlugin = Record<
  ColumnDraggingPluginScope,
  ColumnDraggingPluginParams
>
