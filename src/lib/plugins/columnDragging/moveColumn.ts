/**
 * Перестановка узла (лист или группа) к соседнему перемещаемому узлу того же родителя
 * — общая для `Alt+Shift+←/→` (ADR 0031, KB3) и меню ручки (ADR 0034, DA2; ADR 0052,
 * ND5): тот же `setColumnOrder` и `onColumnDragEnd`, что у DnD; промис колбэка — ожидание
 * и откат (ADR 0114).
 */
import { readPluginHooks } from '../../core/definePlugin'
import {
  type NodeHeader,
  draggableIndexOfNode,
  isMovableNode,
  leafColumnsOf,
  nodeColumnIdsOf,
  moveBlock,
  siblingsOf,
} from '../../core/columnNodes'
import {
  flashNode,
  neighboursOf,
  readColumnMoves,
  settleColumnMove,
} from './commitColumnMove'
import type { ColumnDraggingHooks } from './types'

interface MoveTable {
  setColumnOrder: (updater: (prev: string[]) => string[]) => void
  getVisibleLeafColumns: () => { id: string }[]
  getHeaderGroups: () => { headers: NodeHeader[] }[]
  atoms: { columnOrder?: { get: () => string[] } }
}

/** `-1` — влево, `1` — вправо. */
export type ColumnMoveDirection = -1 | 1

/** Узел переносим и его прошлый перенос не ждёт промиса (ADR 0114). */
export const isMovableColumn = (header: unknown) => {
  const node = header as NodeHeader & {
    getContext: () => { table: unknown }
  }
  return (
    isMovableNode(node) &&
    !(node.column.id in readColumnMoves(node.getContext().table))
  )
}

const findMove = (
  table: unknown,
  header: NodeHeader,
  direction: ColumnMoveDirection,
) => {
  const movable = siblingsOf(table as MoveTable, header).filter(isMovableNode)
  const position = movable.findIndex(node => node.id === header.id)
  const neighbour = movable[position + direction]
  return position === -1 || !neighbour ? null : neighbour
}

/** Текущий порядок листьев: срез `columnOrder` или порядок видимых колонок. */
export const currentLeafOrder = (table: unknown) => {
  const t = table as MoveTable
  const order = t.atoms.columnOrder?.get() ?? []
  return order.length > 0 ? order : t.getVisibleLeafColumns().map(c => c.id)
}

/** Переставить узел за/перед соседа, сообщить колбэку; возвращает новый порядок. */
export const applyNodeMove = (
  table: unknown,
  active: NodeHeader,
  target: NodeHeader,
  toRight: boolean,
) => {
  const base = currentLeafOrder(table)
  const leaves = leafColumnsOf(active).map(leaf => leaf.id)
  const next = moveBlock(base, active, target, toRight)
  // Индексы — по порядку до перестановки.
  const dragIndex = draggableIndexOfNode(active)
  const hoverIndex = draggableIndexOfNode(target)
  ;(table as MoveTable).setColumnOrder(() => next)
  // Колонка вспыхивает на новом месте, как строка (ADR 0114, §4).
  const nodes = nodeColumnIdsOf(active)
  flashNode(table, nodes, 'arrived')
  const result = readPluginHooks<Partial<ColumnDraggingHooks>>(
    table as Parameters<typeof readPluginHooks>[0],
    'columnDragging',
  ).onColumnDragEnd?.({
    dragIndex,
    hoverIndex,
    columnId: active.column.id,
    columnOrder: next,
  })
  settleColumnMove(
    table,
    active.column.id,
    { leaves, nodes, ...neighboursOf(base, leaves) },
    result,
  )
  return next
}

export const canMoveColumn = (
  table: unknown,
  header: unknown,
  direction: ColumnMoveDirection,
) => findMove(table, header as NodeHeader, direction) !== null

export const moveColumn = (
  table: unknown,
  header: unknown,
  direction: ColumnMoveDirection,
) => {
  const neighbour = findMove(table, header as NodeHeader, direction)
  if (neighbour) {
    applyNodeMove(table, header as NodeHeader, neighbour, direction === 1)
  }
}
