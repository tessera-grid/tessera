/**
 * Слот-ручка перетаскивания столбца. Реактивность на срезе `columnDraggingActiveId`
 * (`useSlice`); ручка гаснет у закреплённых (`getIsPinned`). Переиспользуем
 * grid-компонент DragHandler. Хуки не читает — колбэк живёт в dnd-редьюсере и
 * `moveColumn`. Клик по ручке — меню «Move left / right» (ADR 0034, DA1).
 */
import type { HeaderComponentProps } from '../../core/createSlots'
import { useLocalization } from '../../core/localization'
import { useSlice } from '../../core/reactivity'
import { DragHandler } from '../../grid/dnd'
import {
  type ColumnMoveDirection,
  canMoveColumn,
  moveColumn,
} from './moveColumn'

export const ColumnDraggingComponent = ({
  header,
  column,
  table,
}: HeaderComponentProps) => {
  // Всегда-присутствующий срез плагина (реактивность dnd).
  useSlice(table, 'columnDraggingActiveId')
  const labels = useLocalization()

  if (!column.getCanDrag()) {
    return null
  }

  const item = (id: string, label: string, direction: ColumnMoveDirection) => ({
    id,
    label,
    disabled: !canMoveColumn(table, column, direction),
    onSelect: () => moveColumn(table, column, direction),
  })

  return (
    <DragHandler
      id={column.id}
      type="column"
      disabled={column.getIsPinned() !== false}
      label={labels.moveColumn}
      getMenuItems={
        header.subHeaders.length === 0
          ? () => [
              item('moveLeft', labels.moveLeft, -1),
              item('moveRight', labels.moveRight, 1),
            ]
          : undefined
      }
    />
  )
}
