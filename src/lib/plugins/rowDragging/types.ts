/** Типы плагина rowDragging. */
import type { Row } from '../../types'
import type { SessionCancelReason } from '../../core/cancelInteraction'
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
  /** Строка переставлена; индексы — позиции в показанных строках до перестановки. */
  onRowDragEnd: (props: {
    rowId: string
    dragIndex: number
    hoverIndex: number
  }) => void
  /** Перетаскивание завершилось без перестановки (ADR 0040, §1). */
  onRowDragCancel?: (end: {
    rowId: string
    reason: SessionCancelReason
  }) => void
}

export interface RowSortableData {
  virtualIndex: number
  row: Row<any, any>
  parentRow?: Row<any, any>
}
