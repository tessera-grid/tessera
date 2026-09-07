import { Table } from '@tanstack/react-table'

import { ROW_NESTING_INDENT_PX } from '../../core/rowNesting'

export interface RowDraggableRowOffsetLeftParams {
  table: Table
}

/**
 * Пиксельный «шаг» одного уровня вложенности при перетаскивании строки — на него
 * `offsetLeft` смещает строку-оверлей по X (`translate3d`, `BodyRow`) за каждый
 * уровень depth. Складывается из:
 *  - реальной суммарной ширины лидирующих сервисных колонок (чекбокс, drag-ручка,
 *    раскрытие…) — до первой пользовательской колонки. Ширины берём по факту
 *    (`getSize()`), а не по предполагаемым константам: набор и ширина сервисных
 *    колонок различны (drag-колонка 24px ≠ колонка действий 40px);
 *  - шага отступа вложенности `ROW_NESTING_INDENT_PX` — общего с rowExpanding
 *    (paddingLeft контента = шаг × depth), чтобы индикатор совпадал с раскладкой.
 */
export const getRowDraggableOffsetLeft = ({
  table,
}: RowDraggableRowOffsetLeftParams) => {
  const visibleColumns = table.getVisibleLeafColumns()

  const firstUserColumnIndex = visibleColumns.findIndex(
    visibleColumn => !visibleColumn.getIsActionsColumn(),
  )

  // -1 (пользовательских колонок нет) трактуем как «все колонки — сервисные».
  const leadingServiceCount =
    firstUserColumnIndex === -1 ? visibleColumns.length : firstUserColumnIndex

  const leadingServiceWidth = visibleColumns
    .slice(0, leadingServiceCount)
    .reduce((sum, column) => sum + column.getSize(), 0)

  return leadingServiceWidth + ROW_NESTING_INDENT_PX
}
