/**
 * Сервисная колонка-ручка перетаскивания строки. `cell` — компонент напрямую
 * (нативный FlexRender).
 */
import {
  COLUMN_ACTIONS_SIZE,
  getActionColumnId,
} from '../../core/createColumns/actionColumnParams'
import type { ColumnDef } from '../../types'
import { RowDraggingComponent } from './RowDraggingComponent'

export const COLUMN_DRAGGING_ID = getActionColumnId('rowDragging')
/** Ширина — как у колонок выбора и раскрытия: ручка — кнопка кита (ADR 0112). */
export const COLUMN_DRAGGING_SIZE = COLUMN_ACTIONS_SIZE

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
