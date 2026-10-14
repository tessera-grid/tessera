/** Типы плагина rowDragging. */
import type { Row } from '../../types'
import type { SessionCancelReason } from '../../core/cancelInteraction'
import type { DragOverlayState } from '../columnDragging/types'

export interface RowDragOverlayState {
  activeId: DragOverlayState
  offsetLeft: number
  isExpanded: boolean
  acceptable: boolean
  /** Превью броска (ADR 0108): индексы в показанных строках и глубина на новом месте. */
  fromIndex: number | null
  overIndex: number | null
  /** Строка под слотом: по ней место выравнивается, когда строки окна сдвинулись. */
  overId: string | null
  depth: number
  /** Группы, раскрытые паузой над ними за сессию (ADR 0109, §3). */
  openedByDelay: readonly string[]
}

export const DEFAULT_ROW_DRAG_OVERLAY_STATE: RowDragOverlayState = {
  activeId: null,
  offsetLeft: 0,
  isExpanded: false,
  acceptable: true,
  fromIndex: null,
  overIndex: null,
  overId: null,
  depth: 0,
  openedByDelay: [],
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
