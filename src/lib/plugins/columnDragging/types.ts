import { UniqueIdentifier } from '@dnd-kit/core'
import { Updater } from '@tanstack/react-table'

export type DragOverlayState = UniqueIdentifier | null

export interface ColumnDraggingState {
  columnDraggingActiveId: DragOverlayState
}

export interface ColumnDraggingOptions {
  onColumnDraggingActiveIdChange: (updater: Updater<DragOverlayState>) => void
}

export type ColumnDraggingPluginScope = 'columnDragging'

export interface ColumnDraggingPluginParams {
  onColumnDragEnd: (props: { dragIndex: number; hoverIndex: number }) => void
}

export type ColumnDraggingPlugin = Record<
  ColumnDraggingPluginScope,
  ColumnDraggingPluginParams
>
