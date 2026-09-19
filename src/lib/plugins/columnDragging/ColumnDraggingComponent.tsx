/**
 * Слот-ручка перетаскивания столбца. Реактивность на
 * `useSelector(table.atoms.columnDraggingActiveId)`; ручка гаснет у закреплённых
 * (`getIsPinned`). Переиспользуем grid-компонент DragHandler.
 */
import { useSelector } from '@tanstack/react-store'

import type { HeaderComponentProps } from '../../core/createSlots'
import { DragHandler } from '../../grid/dnd'

export const ColumnDraggingComponent = ({
  column,
  table,
}: HeaderComponentProps) => {
  // Всегда-присутствующий срез плагина (реактивность dnd).
  useSelector(
    (table as unknown as { atoms: { columnDraggingActiveId: unknown } }).atoms
      .columnDraggingActiveId as never,
  )

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
