/**
 * Перестановка и смена вложенности строки — общие для `Alt+Shift+стрелок`
 * (ADR 0031, KB4; ADR 0032, W12) и меню ручки (ADR 0034, DA3–DA4). Изменения —
 * через тот же `onRowOrderChange`, что у DnD.
 */
import { arrayMove } from '@dnd-kit/sortable'

import { readPluginHooks } from '../../core/definePlugin'
import { markRowDrop } from './rowDrops'
import type { RowDraggingHooks } from './types'

interface OrderItem {
  id: string
  parentId?: string
  subRows?: OrderItem[]
}

type OnRowOrderChange = (updater: (prev: OrderItem[]) => OrderItem[]) => void

interface MoveRow {
  id: string
  index: number
  depth: number
  subRows: MoveRow[]
  getCanDrag: () => boolean
  getParentRow: () => MoveRow | undefined
  getCanExpand?: () => boolean
  toggleExpanded?: (expanded?: boolean) => void
}

interface MoveTable {
  options: { onRowOrderChange?: OnRowOrderChange }
  getCoreRowModel: () => { rows: MoveRow[] }
  getRowModel: () => { rows: MoveRow[] }
  getHooks: () => unknown
}

/** `-1` — вверх, `1` — вниз. */
export type RowMoveDirection = -1 | 1

const onRowOrderChangeOf = (table: unknown) =>
  (table as MoveTable).options.onRowOrderChange

/** Строку можно переставлять: её разрешено тянуть и потребитель принимает порядок. */
export const isMovableRow = (row: unknown, table: unknown) =>
  (row as MoveRow).getCanDrag() && !!onRowOrderChangeOf(table)

const siblingsOf = (row: MoveRow, table: unknown) =>
  row.getParentRow()?.subRows ?? (table as MoveTable).getCoreRowModel().rows

export const canMoveRow = (
  row: unknown,
  table: unknown,
  direction: RowMoveDirection,
) => {
  const r = row as MoveRow
  const to = r.index + direction
  return to >= 0 && to < siblingsOf(r, table).length
}

export const moveRow = (
  row: unknown,
  table: unknown,
  direction: RowMoveDirection,
) => {
  if (!canMoveRow(row, table, direction)) {
    return
  }
  const r = row as MoveRow
  const t = table as MoveTable
  const parent = r.getParentRow()
  const from = r.index
  const to = from + direction
  const shown = t.getRowModel().rows
  const neighbour = siblingsOf(r, table)[to]
  const dragIndex = shown.findIndex(item => item.id === r.id)
  const hoverIndex = shown.findIndex(item => item.id === neighbour.id)
  onRowOrderChangeOf(table)?.(prev =>
    parent
      ? prev.map(item =>
          item.id === parent.id
            ? { ...item, subRows: arrayMove(item.subRows ?? [], from, to) }
            : item,
        )
      : arrayMove(prev, from, to),
  )
  markRowDrop(table, r.id)
  readPluginHooks<Partial<RowDraggingHooks>>(t, 'rowDragging').onRowDragEnd?.({
    rowId: r.id,
    dragIndex,
    hoverIndex,
  })
}

/** Предыдущая корневая строка-группа, в которую вкладывается строка. */
const nestTargetOf = (row: MoveRow, table: unknown) => {
  if (row.getParentRow() || row.subRows.length > 0) {
    return undefined
  }
  const target = (table as MoveTable).getCoreRowModel().rows[row.index - 1]
  return target?.getCanExpand?.() ? target : undefined
}

/** Корневая строка без подстрок вкладывается в предыдущую группу — не группа в группу. */
export const canNestRow = (row: unknown, table: unknown) =>
  !!nestTargetOf(row as MoveRow, table)

/** Строка становится последней подстрокой предыдущей корневой группы. */
export const nestRow = (row: unknown, table: unknown) => {
  const r = row as MoveRow
  const target = nestTargetOf(r, table)
  if (!target) {
    return
  }
  onRowOrderChangeOf(table)?.(prev => {
    const item = prev[r.index]
    if (!item) {
      return prev
    }
    return prev
      .filter((_, i) => i !== r.index)
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
  markRowDrop(table, r.id)
  // Раскрыть группу, чтобы строка осталась видимой и фокус последовал за ней.
  target.toggleExpanded?.(true)
}

/** Выносится только подстрока корневой группы. */
export const canUnnestRow = (row: unknown) => {
  const parent = (row as MoveRow).getParentRow()
  return !!parent && parent.depth === 0
}

/** Подстрока встаёт в корень сразу после родителя. */
export const unnestRow = (row: unknown, table: unknown) => {
  if (!canUnnestRow(row)) {
    return
  }
  const r = row as MoveRow
  const parent = r.getParentRow()!
  onRowOrderChangeOf(table)?.(prev => {
    const parentIndex = prev.findIndex(item => item.id === parent.id)
    const item = prev[parentIndex]?.subRows?.[r.index]
    if (!item) {
      return prev
    }
    const next = prev.map(entry =>
      entry.id === parent.id
        ? {
            ...entry,
            subRows: entry.subRows!.filter((_, i) => i !== r.index),
          }
        : entry,
    )
    next.splice(parentIndex + 1, 0, { ...item, parentId: undefined })
    return next
  })
  markRowDrop(table, r.id)
}
