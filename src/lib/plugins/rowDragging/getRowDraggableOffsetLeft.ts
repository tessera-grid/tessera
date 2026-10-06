import type { Table } from '../../types'
import { readRowNestingIndent } from '../../core/rowNesting'

export interface RowDraggableRowOffsetLeftParams {
  table: Table<any, any>
}

/**
 * Пиксельный «шаг» одного уровня вложенности при перетаскивании строки — на него
 * `offsetLeft` смещает строку-оверлей по X (`translate3d`, `BodyRow`) за каждый
 * уровень depth. Складывается из:
 *  - реальной суммарной ширины лидирующих сервисных колонок (чекбокс, drag-ручка,
 *    раскрытие…) — до первой пользовательской колонки. Ширины берём по факту
 *    (`getSize()`), а не по предполагаемым константам: набор и ширина сервисных
 *    колонок различны (drag-колонка 24px ≠ колонка действий 40px);
 *  - шага отступа вложенности — токена темы, общего с отступом первой колонки
 *    (ADR 0059), чтобы индикатор совпадал с раскладкой.
 */
export const getRowDraggableOffsetLeft = ({
  table,
}: RowDraggableRowOffsetLeftParams) => {
  const visibleColumns = table.getVisibleLeafColumns()

  const firstUserColumnIndex = visibleColumns.findIndex(
    (visibleColumn: any) => !visibleColumn.getIsActionsColumn(),
  )

  // -1 (пользовательских колонок нет) трактуем как «все колонки — сервисные».
  const leadingServiceCount =
    firstUserColumnIndex === -1 ? visibleColumns.length : firstUserColumnIndex

  const leadingServiceWidth = visibleColumns
    .slice(0, leadingServiceCount)
    .reduce((sum: number, column: any) => sum + column.getSize(), 0)

  return leadingServiceWidth + readRowNestingIndent(table)
}
