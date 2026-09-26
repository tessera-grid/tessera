/**
 * Перестановка колонки к соседней перемещаемой (незакреплённой, `getCanDrag`) —
 * общая для `Alt+Shift+←/→` (ADR 0031, KB3) и меню ручки (ADR 0034, DA2): тот же
 * `setColumnOrder` и `onColumnDragEnd`, что у DnD.
 */
import { arrayMove } from '@dnd-kit/sortable'

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

/** `-1` — влево, `1` — вправо. */
export type ColumnMoveDirection = -1 | 1

export const isMovableColumn = (column: unknown) => {
  const c = column as MovableColumn
  return c.getCanDrag() && c.getIsPinned() === false
}

const findMove = (
  table: unknown,
  column: { id: string },
  direction: ColumnMoveDirection,
) => {
  const movable = (table as MoveTable)
    .getVisibleLeafColumns()
    .filter(isMovableColumn)
  const position = movable.findIndex(c => c.id === column.id)
  const neighbour = movable[position + direction]
  return position === -1 || !neighbour
    ? null
    : { active: movable[position], neighbour }
}

export const canMoveColumn = (
  table: unknown,
  column: { id: string },
  direction: ColumnMoveDirection,
) => findMove(table, column, direction) !== null

export const moveColumn = (
  table: unknown,
  column: { id: string },
  direction: ColumnMoveDirection,
) => {
  const move = findMove(table, column, direction)
  if (!move) {
    return
  }
  const t = table as MoveTable
  const from = move.active.getIndex()
  const to = move.neighbour.getIndex()
  t.setColumnOrder(prev =>
    arrayMove(
      prev.length > 0 ? prev : t.getVisibleLeafColumns().map(c => c.id),
      from,
      to,
    ),
  )
  readPluginHooks<Partial<ColumnDraggingHooks>>(
    table as Parameters<typeof readPluginHooks>[0],
    'columnDragging',
  ).onColumnDragEnd?.({
    dragIndex: move.active.getDraggableIndex(),
    hoverIndex: move.neighbour.getDraggableIndex(),
  })
}
