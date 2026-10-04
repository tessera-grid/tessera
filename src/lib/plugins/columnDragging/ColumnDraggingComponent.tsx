/**
 * Слот-ручка перетаскивания столбца. Реактивность на срезе `columnDraggingActiveId`
 * (`useSlice`); ручка гаснет у закреплённого узла (зона листьев). Переиспользуем
 * grid-компонент DragHandler. Хуки не читает — колбэк живёт в dnd-редьюсере и
 * `moveColumn`. Клик по ручке — меню «Move left / right» (ADR 0034, DA1) — и у
 * группы (ADR 0052, ND5).
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
import { zoneOf } from '../../core/columnNodes'

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
    disabled: !canMoveColumn(table, header, direction),
    onSelect: () => moveColumn(table, header, direction),
  })

  return (
    <DragHandler
      id={column.id}
      type="column"
      disabled={zoneOf(header as never) !== false}
      label={labels.moveColumn}
      getMenuItems={() => [
        item('moveLeft', labels.moveLeft, -1),
        item('moveRight', labels.moveRight, 1),
      ]}
    />
  )
}
