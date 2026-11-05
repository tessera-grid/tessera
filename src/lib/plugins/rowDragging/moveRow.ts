/**
 * Перестановка и смена вложенности строки — общие для `Alt+Shift+стрелок`
 * (ADR 0031, KB4; ADR 0032, W12) и меню ручки (ADR 0034, DA3–DA4). Изменения —
 * через тот же `onRowOrderChange`, что у DnD; в ленивом дереве — стадией модели и
 * промисом `onRowDragEnd` (ADR 0112).
 */
import { arrayMove } from '@dnd-kit/sortable'

import { readPluginHooks } from '../../core/definePlugin'
import { readRowMoves } from '../../shared/rowMoves'
import { commitRowMove, type RowMoveCommit } from './commitRowMove'
import { canNestInto } from './draggingHelpers'
import { isClientGrouped } from './groupMove'
import {
  moveServerRow,
  type RowMoveEdge,
  serverMoveSource,
  serverMoveTarget,
} from './serverMove'
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
  original: unknown
  parentId?: string
  getIsLazyParent?: () => boolean
  setExpandedByUser?: (expanded: boolean) => void
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

/**
 * Строку можно переставлять: её разрешено тянуть, потребитель принимает порядок, и её
 * прошлый перенос завершён (ADR 0112).
 */
export const isMovableRow = (row: unknown, table: unknown) =>
  (row as MoveRow).getCanDrag() &&
  // Порядок серверной модели — в её кэше, `onRowOrderChange` не нужен (ADR 0159, §2).
  (!!onRowOrderChangeOf(table) ||
    !!serverMoveSource(table) ||
    isClientGrouped(table)) &&
  !((row as MoveRow).id in readRowMoves(table))

const isLazy = (row: MoveRow | undefined) => !!row?.getIsLazyParent?.()

/** Колбэк, ожидание и запись — общий путь броска (ADR 0112). */
const commit = (
  table: unknown,
  row: MoveRow,
  to: { parent?: MoveRow; index: number },
  dragIndex: number,
  hoverIndex: number,
  write: () => void,
) => {
  const from = row.getParentRow()
  const lazy = isLazy(from) || isLazy(to.parent)
  const anchors = (
    to.parent?.subRows ?? (table as MoveTable).getCoreRowModel().rows
  )
    .map(sibling => sibling.id)
    .filter(id => id !== row.id)
  const move: RowMoveCommit = {
    rowId: row.id,
    original: row.original,
    anchors,
    fromAnchors: (from?.subRows ?? (table as MoveTable).getCoreRowModel().rows)
      .map(sibling => sibling.id)
      .filter(id => id !== row.id),
    fromIndex: row.index,
    dragIndex,
    hoverIndex,
    parentId: to.parent?.id,
    previousParentId: from?.id,
    index: to.index,
    ...(lazy
      ? {
          lazy: {
            original: row.original,
            from: { parentId: from?.id, index: row.index, lazy: isLazy(from) },
            to: {
              parentId: to.parent?.id,
              index: to.index,
              lazy: isLazy(to.parent),
              anchors,
            },
          },
        }
      : { write }),
  }
  commitRowMove(
    table,
    move,
    readPluginHooks<Partial<RowDraggingHooks>>(table as never, 'rowDragging')
      .onRowDragEnd,
  )
}

/** Раскрыть путём клика: ленивая группа грузит детей (ADR 0054). */
const expand = (row: MoveRow) =>
  row.setExpandedByUser
    ? row.setExpandedByUser(true)
    : row.toggleExpanded?.(true)

const siblingsOf = (row: MoveRow, table: unknown) =>
  row.getParentRow()?.subRows ?? (table as MoveTable).getCoreRowModel().rows

export const canMoveRow = (
  row: unknown,
  table: unknown,
  direction: RowMoveDirection,
) => {
  const server = serverMoveSource(table)
  if (server) {
    return (
      serverMoveTarget(server, (row as MoveRow).id, direction) !== undefined
    )
  }
  // Перестановки внутри клиентской группы нет (ADR 0186, §4).
  if (isClientGrouped(table)) return false
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
  if (serverMoveSource(table)) {
    moveServerRow(table, (row as MoveRow).id, direction)
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
  commit(table, r, { parent, index: to }, dragIndex, hoverIndex, () =>
    onRowOrderChangeOf(table)?.(prev =>
      parent
        ? prev.map(item =>
            item.id === parent.id
              ? { ...item, subRows: arrayMove(item.subRows ?? [], from, to) }
              : item,
          )
        : arrayMove(prev, from, to),
    ),
  )
}

/** Предыдущая корневая строка-группа, в которую вкладывается строка. */
const nestTargetOf = (row: MoveRow, table: unknown) => {
  // В серверной модели вложение и вынос — только броском (ADR 0159, §6).
  if (serverMoveSource(table) || row.getParentRow() || row.subRows.length > 0) {
    return undefined
  }
  const target = (table as MoveTable).getCoreRowModel().rows[row.index - 1]
  return target && canNestInto(target, table) ? target : undefined
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
  const shown = (table as MoveTable).getRowModel().rows
  const dragIndex = shown.findIndex(item => item.id === r.id)
  const hoverIndex = shown.findIndex(item => item.id === target.id)
  commit(
    table,
    r,
    { parent: target, index: target.subRows.length },
    dragIndex,
    hoverIndex,
    () =>
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
      }),
  )
  // Раскрыть группу, чтобы строка осталась видимой и фокус последовал за ней.
  expand(target)
}

/** Выносится только подстрока корневой группы. */
export const canUnnestRow = (row: unknown, table: unknown) => {
  if (serverMoveSource(table) || isClientGrouped(table)) return false
  const parent = (row as MoveRow).getParentRow()
  return !!parent && parent.depth === 0
}

/** Подстрока встаёт в корень сразу после родителя. */
export const unnestRow = (row: unknown, table: unknown) => {
  if (!canUnnestRow(row, table)) {
    return
  }
  const r = row as MoveRow
  const parent = r.getParentRow()!
  const shown = (table as MoveTable).getRowModel().rows
  const dragIndex = shown.findIndex(item => item.id === r.id)
  const hoverIndex = shown.findIndex(item => item.id === parent.id)
  commit(table, r, { index: parent.index + 1 }, dragIndex, hoverIndex, () =>
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
    }),
  )
}

/** Перенос к краю списка серверной модели (ADR 0159, §6). */
export const canMoveRowToEdge = (
  row: unknown,
  table: unknown,
  edge: RowMoveEdge,
) => {
  const server = serverMoveSource(table)
  return (
    !!server &&
    serverMoveTarget(server, (row as MoveRow).id, edge) !== undefined
  )
}

export const moveRowToEdge = (
  row: unknown,
  table: unknown,
  edge: RowMoveEdge,
) => moveServerRow(table, (row as MoveRow).id, edge)
