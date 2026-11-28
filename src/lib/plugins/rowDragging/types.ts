/** Типы плагина rowDragging. */
import type { Row } from '../../types'
import type { SessionCancelReason } from '../../core/cancelInteraction'
import type { DragOverlayState } from '../../shared/dragOverlay'
import type { RowDragSession } from '../../core/dragSession'

/** Срез сессии перетаскивания строки: поля, которые рисует грид, — у ядра (ADR 0168, §3). */
export interface RowDragOverlayState extends RowDragSession {
  activeId: DragOverlayState
  isExpanded: boolean
  /** Строка под слотом: по ней место выравнивается, когда строки окна сдвинулись. */
  overId: string | null
  /** Группы, раскрытые паузой над ними за сессию (ADR 0109, §3). */
  openedByDelay: readonly string[]
  /** Место недопустимо только до прихода строк ветки серверной модели (ADR 0159, §4). */
  waitsForBranch: boolean
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
  waitsForBranch: false,
}

export interface RowDraggingState {
  rowDragging: RowDragOverlayState
}

export interface RowDragEnd {
  rowId: string
  dragIndex: number
  hoverIndex: number
  /** Parent after the move; `undefined` — the root. */
  parentId?: string
  /** Parent before the move. */
  previousParentId?: string
  /** Position among siblings after the move. */
  index: number
  /** Position among siblings before the move (ADR 0222, §13). */
  previousIndex: number
  /** The move was made by the edit history: undo or redo (ADR 0222, §13). */
  source?: 'undo' | 'redo'
  /**
   * Server grouping (ADR 0159, §5): the group's grouping column values after the move — column →
   * value.
   */
  groupValues?: Record<string, unknown>
  /** The group's grouping column values before the move. */
  previousGroupValues?: Record<string, unknown>
}

export interface RowDraggingHooks {
  /**
   * A row was reordered (ADR 0112): `dragIndex`/`hoverIndex` are positions among the shown rows
   * before the move, `parentId`/`index` are the parent and the position among siblings after it.
   * A promise shows pending on the handle; a rejected lazy move returns the row.
   */
  onRowDragEnd: (props: RowDragEnd) => void | PromiseLike<unknown>
  /** The drag ended without reordering (ADR 0040, §1). */
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
