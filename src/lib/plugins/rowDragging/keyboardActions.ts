/**
 * Клавиатурная альтернатива перетаскиванию строк: `Alt+Shift+↑/↓` на любой ячейке
 * строки переставляет её с соседней строкой того же уровня (ADR 0031, KB4),
 * `Alt+Shift+→/←` вкладывает её в предыдущую группу / выносит на уровень выше
 * (ADR 0032, W12). Изменения — через тот же `onRowOrderChange`, что у DnD.
 */
import { arrayMove } from '@dnd-kit/sortable'

import type { CellKeyboardAction } from '../../core/keyboardActions'

interface OrderItem {
  id: string
  parentId?: string
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

/**
 * `→` — корневая строка без подстрок становится последней подстрокой предыдущей
 * корневой группы (раскрываемой строки); `←` — подстрока встаёт в корень сразу
 * после родителя. Группа в группу не вкладывается — как у DnD.
 */
export const nestRowKeyboardAction: CellKeyboardAction = {
  id: 'rowDragging.nest',
  scope: 'cell',
  keys: ['Alt+Shift+ArrowRight', 'Alt+Shift+ArrowLeft'],
  visible: ({ row, table }) => row.getCanDrag() && !!getOnRowOrderChange(table),
  run: ({ row, table }, event) => {
    const onRowOrderChange = getOnRowOrderChange(table)
    const parent = row.getParentRow()

    if (event.key === 'ArrowLeft') {
      if (!parent || parent.depth > 0) {
        return
      }
      onRowOrderChange?.(prev => {
        const parentIndex = prev.findIndex(item => item.id === parent.id)
        const item = prev[parentIndex]?.subRows?.[row.index]
        if (!item) {
          return prev
        }
        const next = prev.map(entry =>
          entry.id === parent.id
            ? {
                ...entry,
                subRows: entry.subRows!.filter((_, i) => i !== row.index),
              }
            : entry,
        )
        next.splice(parentIndex + 1, 0, { ...item, parentId: undefined })
        return next
      })
      return
    }

    const target = table.getCoreRowModel().rows[row.index - 1]
    if (parent || row.subRows.length > 0 || !target?.getCanExpand?.()) {
      return
    }
    onRowOrderChange?.(prev => {
      const item = prev[row.index]
      if (!item) {
        return prev
      }
      return prev
        .filter((_, i) => i !== row.index)
        .map(entry =>
          entry.id === target.id
            ? {
                ...entry,
                subRows: [
                  ...(entry.subRows ?? []),
                  { ...item, parentId: target.id },
                ],
              }
            : entry,
        )
    })
    // Раскрыть группу, чтобы строка осталась видимой и фокус последовал за ней.
    target.toggleExpanded?.(true)
  },
}
