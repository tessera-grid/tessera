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

export const COLUMN_DRAGGING_ID = getActionColumnId('rowDragging')
/** Компактная кнопка кита — `--tsr-comp-button-size-compact` (ADR 0114). */
const DRAG_HANDLE_SIZE = 24

export const COLUMN_DRAGGING_SIZE =
  DRAG_HANDLE_SIZE + ACTION_COLUMN_CONTENT_PADDING * 2

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
