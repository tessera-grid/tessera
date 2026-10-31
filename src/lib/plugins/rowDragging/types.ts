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
  /** Родитель после переноса; `undefined` — корень. */
  parentId?: string
  /** Родитель до переноса. */
  previousParentId?: string
  /** Место среди сестёр после переноса. */
  index: number
  /**
   * Серверная группировка (ADR 0159, §5): значения колонок группировки группы после
   * переноса — колонка → значение.
   */
  groupValues?: Record<string, unknown>
  /** Значения колонок группировки группы до переноса. */
  previousGroupValues?: Record<string, unknown>
}

export interface RowDraggingHooks {
  /**
   * Строка переставлена (ADR 0112): `dragIndex`/`hoverIndex` — позиции в показанных
   * строках до перестановки, `parentId`/`index` — родитель и место среди сестёр после
   * неё. Промис — ожидание на ручке; отказ ленивого переноса возвращает строку.
   */
  onRowDragEnd: (props: RowDragEnd) => void | PromiseLike<unknown>
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
