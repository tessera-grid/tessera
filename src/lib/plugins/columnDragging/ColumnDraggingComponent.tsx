/**
 * Слот-ручка перетаскивания столбца. Реактивность на срезе `columnDraggingActiveId`
 * (`useSlice`); ручка гаснет у закреплённых (`getIsPinned`). Переиспользуем
 * grid-компонент DragHandler. Хуки не читает — колбэк живёт в dnd-редьюсере.
 */
import type { HeaderComponentProps } from '../../core/createSlots'
import { useSlice } from '../../core/reactivity'
import { DragHandler } from '../../grid/dnd'

export const ColumnDraggingComponent = ({
  column,
  table,
}: HeaderComponentProps) => {
  // Всегда-присутствующий срез плагина (реактивность dnd).
  useSlice(table, 'columnDraggingActiveId')

  if (!column.getCanDrag()) {
    return null
  }

  return (
    <DragHandler
      id={column.id}
      type="column"
      disabled={column.getIsPinned() !== false}
    />
  )
}
