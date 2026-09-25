/**
 * Клавиатурная альтернатива перетаскиванию строк (ADR 0031, KB4):
 * `Alt+Shift+↑/↓` на любой ячейке строки переставляет её с соседней строкой того
 * же уровня (корень или подстроки одной группы) через тот же `onRowOrderChange`,
 * что у DnD. Смена уровня вложенности — только перетаскиванием.
 */
import { arrayMove } from '@dnd-kit/sortable'

import type { CellKeyboardAction } from '../../core/keyboardActions'

interface OrderItem {
  id: string
  subRows?: OrderItem[]
}

type OnRowOrderChange = (updater: (prev: OrderItem[]) => OrderItem[]) => void

const getOnRowOrderChange = (table: unknown) =>
  (table as { options: { onRowOrderChange?: OnRowOrderChange } }).options
    .onRowOrderChange

export const moveRowKeyboardAction: CellKeyboardAction = {
  id: 'rowDragging.move',
  scope: 'cell',
  keys: ['Alt+Shift+ArrowUp', 'Alt+Shift+ArrowDown'],
  visible: ({ row, table }) => row.getCanDrag() && !!getOnRowOrderChange(table),
  run: ({ row, table }, event) => {
    const parent = row.getParentRow()
    const siblings = parent ? parent.subRows : table.getCoreRowModel().rows
    const from = row.index
    const to = from + (event.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= siblings.length) {
      return
    }
    getOnRowOrderChange(table)?.(prev =>
      parent
        ? prev.map(item =>
            item.id === parent.id
              ? { ...item, subRows: arrayMove(item.subRows ?? [], from, to) }
              : item,
          )
        : arrayMove(prev, from, to),
    )
  },
}
