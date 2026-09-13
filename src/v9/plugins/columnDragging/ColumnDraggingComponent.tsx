/**
 * Фаза E — слот-ручка перетаскивания столбца (v9-порт). Реактивность на
 * `useSelector(table.atoms.columnPinning)` (ручка гаснет у закреплённых) вместо
 * useSubscribeStore. Переиспользуем grid-компонент DragHandler.
 */
import { useSelector } from '@tanstack/react-store'

import type { HeaderComponentProps } from '../../core/createSlots'
import { DragHandler } from '../../grid/dnd'

export const ColumnDraggingComponent = ({ column, table }: HeaderComponentProps) => {
  // Всегда-присутствующий срез плагина (реактивность dnd). Тонкую подписку на
  // пиннинг (ручка гаснет у закреплённых) добавим при wiring грида на cutover.
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
