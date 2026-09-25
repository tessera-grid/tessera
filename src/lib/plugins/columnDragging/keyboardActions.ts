/**
 * Клавиатурная альтернатива перетаскиванию колонок (ADR 0031, KB3):
 * `Alt+Shift+←/→` на заголовке переставляет колонку к соседней перетаскиваемой
 * незакреплённой — с тем же `setColumnOrder` и `onColumnDragEnd`, что у DnD.
 */
import { arrayMove } from '@dnd-kit/sortable'

import type { HeaderKeyboardAction } from '../../core/keyboardActions'
import { readPluginHooks } from '../../core/definePlugin'
import type { ColumnDraggingHooks } from './types'

interface MovableColumn {
  id: string
  getIndex: () => number
  getDraggableIndex: () => number
  getCanDrag: () => boolean
  getIsPinned: () => false | 'start' | 'end'
}

interface MoveTable {
  setColumnOrder: (updater: (prev: string[]) => string[]) => void
  getVisibleLeafColumns: () => MovableColumn[]
}

const isMovable = (column: MovableColumn) =>
  column.getCanDrag() && column.getIsPinned() === false

export const moveColumnKeyboardAction: HeaderKeyboardAction = {
  id: 'columnDragging.move',
  scope: 'header',
  keys: ['Alt+Shift+ArrowLeft', 'Alt+Shift+ArrowRight'],
  visible: ({ header, column }) =>
    header.subHeaders.length === 0 && isMovable(column as never),
  run: ({ column, table }, event) => {
    const t = table as unknown as MoveTable
    const movable = t.getVisibleLeafColumns().filter(isMovable)
    const position = movable.findIndex(c => c.id === column.id)
    const neighbour = movable[position + (event.key === 'ArrowLeft' ? -1 : 1)]
    if (position === -1 || !neighbour) {
      return
    }
    const active = movable[position]
    const from = active.getIndex()
    const to = neighbour.getIndex()
    t.setColumnOrder(prev =>
      arrayMove(
        prev.length > 0 ? prev : t.getVisibleLeafColumns().map(c => c.id),
        from,
        to,
      ),
    )
    readPluginHooks<Partial<ColumnDraggingHooks>>(
      table,
      'columnDragging',
    ).onColumnDragEnd?.({
      dragIndex: active.getDraggableIndex(),
      hoverIndex: neighbour.getDraggableIndex(),
    })
  },
}
