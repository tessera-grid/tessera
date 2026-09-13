/**
 * Фаза E — ячейка-ручка перетаскивания строки (v9-порт). Реактивность на
 * всегда-присутствующий срез `rowDragging` вместо useSubscribeStore.
 * Переиспользуем grid-компонент DragHandler.
 */
import { useSelector } from '@tanstack/react-store'

import type { CellComponentProps } from '../../core/createSlots'
import { DragHandler } from '../../../lib/grid/dnd'

export const RowDraggingComponent = ({ row, table }: CellComponentProps) => {
  useSelector(
    (table as unknown as { atoms: { rowDragging: unknown } }).atoms.rowDragging as never,
  )

  if (!row.getCanDrag()) {
    return null
  }

  return <DragHandler id={row.id} type="row" />
}
