/**
 * Сервисная колонка действий строки. Колонка-контейнер: сами действия рисуются
 * гридом в слот `actionRowSlot`. Ширина задаётся авто-слайсом через setup плагина.
 */
import { getActionColumnId } from '../../core/createColumns/actionColumnParams'
import type { ColumnDef } from '../../types'

/** Stable id of the row actions column. */
export const ROW_ACTIONS_COLUMN_ID = getActionColumnId('rowActions')

export interface RowActionsOptions {
  width: number
  /** Ширина при схлопнутых действиях (кебаб rowActionMenu). */
  collapsedWidth: number
}

export const DEFAULT_ROW_ACTIONS_OPTIONS: RowActionsOptions = {
  width: 120,
  collapsedWidth: 56,
}

const leafColumn = {
  id: ROW_ACTIONS_COLUMN_ID,
  accessorKey: ROW_ACTIONS_COLUMN_ID,
  minSize: 0,
  size: 0,
  header: undefined,
  enableSorting: false,
  enableResizing: false,
} as unknown as ColumnDef<any, any, any>

export const getRowActionsColumn = (): ColumnDef<any, any, any> => leafColumn
