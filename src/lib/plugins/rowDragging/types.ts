/** Типы плагина rowDragging. */
import type { Row } from '../../types'
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

export interface RowDraggingHooks {
  onRowDragEnd: (props: { dragIndex: number; hoverIndex: number }) => void
}

export interface RowSortableData {
  virtualIndex: number
  row: Row<any, any>
  parentRow?: Row<any, any>
}
