/**
 * Сервисная колонка-ручка перетаскивания строки. `cell` — компонент напрямую
 * (нативный FlexRender).
 */
import {
  ACTION_COLUMN_CONTENT_PADDING,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import type { ColumnDef } from '../../types'
import { RowDraggingComponent } from './RowDraggingComponent'

const DRAG_ICON_SIZE = 16

export const COLUMN_DRAGGING_ID = getActionColumnId('rowDragging')
export const COLUMN_DRAGGING_SIZE =
  DRAG_ICON_SIZE + ACTION_COLUMN_CONTENT_PADDING * 2

const leafColumn = {
  id: COLUMN_DRAGGING_ID,
  serviceLabel: 'reorderColumn',
  accessorKey: 'id',
  minSize: COLUMN_DRAGGING_SIZE,
  size: COLUMN_DRAGGING_SIZE,
  header: undefined,
  enableSorting: false,
  enableResizing: false,
  cell: RowDraggingComponent,
} as unknown as ColumnDef<any, any, any>

export const getRowDraggingColumn = (): ColumnDef<any, any, any> => leafColumn
