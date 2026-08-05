import { Table } from '@tanstack/react-table'

import { COLUMN_ACTIONS_SIZE } from '../../core/createColumns/actionColumnParams'
import { EXPANDING_DEPTH_OFFSET_PX } from '../rowExpanding/getCellExpandingStyles'
import { COLUMN_DRAGGING_SIZE } from './rowDraggingColumn'

export interface RowDraggableRowOffsetLeftParams {
  table: Table
}

export const getRowDraggableOffsetLeft = ({
  table,
}: RowDraggableRowOffsetLeftParams) => {
  const visibleColumns = table.getVisibleLeafColumns()

  /**
   * Высчитываем величину в пикселях до первой пользовательской колонки, так как перед ней могут находиться кнопки, чекбоксы и тд.
   * Отталкиваясь от первой пользовательской колонки мы будем работать с отступами для визуализации уровня вложенности
   */
  const firstUserColumnIndex = visibleColumns.findIndex(
    visibleColumn => !visibleColumn.getIsActionsColumn(),
  )

  return (
    (firstUserColumnIndex - 1) * COLUMN_ACTIONS_SIZE +
    COLUMN_DRAGGING_SIZE +
    EXPANDING_DEPTH_OFFSET_PX
  )
}
