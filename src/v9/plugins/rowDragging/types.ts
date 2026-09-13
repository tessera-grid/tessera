/** Фаза E — типы плагина rowDragging (v9). */
import type { DragOverlayState } from '../columnDragging/types'

export interface RowDragOverlayState {
  activeId: DragOverlayState
  offsetLeft: number
  isExpanded: boolean
  acceptable: boolean
}

export const DEFAULT_ROW_DRAG_OVERLAY_STATE: RowDragOverlayState = {
  activeId: null,
  offsetLeft: 0,
  isExpanded: false,
  acceptable: true,
}

export interface RowDraggingState {
  rowDragging: RowDragOverlayState
}

export type RowDraggingPluginScope = 'rowDragging'

export interface RowDraggingPluginParams {
  onRowDragEnd: (props: { dragIndex: number; hoverIndex: number }) => void
}

export type RowDraggingPlugin = Record<
  RowDraggingPluginScope,
  RowDraggingPluginParams
>
