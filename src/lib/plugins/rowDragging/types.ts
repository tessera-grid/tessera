import { Row, Updater } from '@tanstack/react-table'

import { DragOverlayState } from '../columnDragging/types'

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

export interface RowDraggingOptions {
  onRowDraggingChange: (updater: Updater<RowDragOverlayState>) => void
}

export type RowDraggingPluginScope = 'rowDragging'

export interface RowDraggingPluginParams {
  // TODO: контракт взаимодействия с плагином по всей видимости нужно будет доработать, так как здесь мы ничего не знаем про вложенность
  onRowDragEnd: (props: { dragIndex: number; hoverIndex: number }) => void
}

export type RowDraggingPlugin = Record<
  RowDraggingPluginScope,
  RowDraggingPluginParams
>

export interface RowSortableData {
  virtualIndex: number
  row: Row<any>
  parentRow?: Row<any>
}
