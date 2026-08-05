// Интерфейс состояния таблицы, получаемое из table.getState()
import { PaginationState } from '@tanstack/react-table'

import { ColumnDraggingState } from '../lib/plugins/columnDragging'
import { RowDraggingState } from '../lib/plugins/rowDragging'

export interface TableStateSDK extends ColumnDraggingState, RowDraggingState {
  // Фикс конфликтов типизации в tanstack в initialState и state
  pagination: Partial<PaginationState>
}
