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
  canShiftServerRow,
  moveServerRow,
  type RowMoveEdge,
  serverMoveSource,
  serverMoveTarget,
  shiftServerRow,
} from './serverMove'
import type { RowDraggingHooks } from './types'
import { positionOf } from '../../core/rowPosition'
import { rowsOf } from '../../core/rowEngine/rows'

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
  getIsExpanded?: () => boolean
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
  history?: 'undo' | 'redo',
) => {
  const from = row.getParentRow()
  const lazy = isLazy(from) || isLazy(to.parent)
  const anchors = (to.parent?.subRows ?? rowsOf<MoveRow>(table, 'core').rows)
    .map(sibling => sibling.id)
    .filter(id => id !== row.id)
  const move: RowMoveCommit = {
    rowId: row.id,
    original: row.original,
    anchors,
    fromAnchors: (from?.subRows ?? rowsOf<MoveRow>(table, 'core').rows)
      .map(sibling => sibling.id)
      .filter(id => id !== row.id),
    fromIndex: positionOf(row),
    dragIndex,
    hoverIndex,
    parentId: to.parent?.id,
    previousParentId: from?.id,
    index: to.index,
    ...(history && { source: history }),
    ...(lazy
      ? {
          lazy: {
            original: row.original,
            from: {
              parentId: from?.id,
              index: positionOf(row),
              lazy: isLazy(from),
            },
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
  row.getParentRow()?.subRows ?? rowsOf<MoveRow>(table, 'core').rows

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
  const to = positionOf(r) + direction
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
  const from = positionOf(r)
  const to = from + direction
  const shown = rowsOf<MoveRow>(t, 'shown').rows
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
  if (row.getParentRow() || row.subRows.length > 0) return undefined
  const target = rowsOf<MoveRow>(table, 'core').rows[positionOf(row) - 1]
  return target && canNestInto(target, table) ? target : undefined
}

/** Корневая строка без подстрок вкладывается в предыдущую группу — не группа в группу. */
export const canNestRow = (row: unknown, table: unknown) =>
  serverMoveSource(table)
    ? canShiftServerRow(table, (row as MoveRow).id, 'in')
    : !!nestTargetOf(row as MoveRow, table)

/** Строка становится последней подстрокой предыдущей корневой группы. */
export const nestRow = (row: unknown, table: unknown) => {
  const r = row as MoveRow
  if (serverMoveSource(table)) {
    shiftServerRow(table, r.id, 'in')
    return
  }
  const target = nestTargetOf(r, table)
  if (!target) {
    return
  }
  const shown = rowsOf<MoveRow>(table, 'shown').rows
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
        const item = prev[positionOf(r)]
        if (!item) {
          return prev
        }
        return prev
          .filter((_, i) => i !== positionOf(r))
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
  if (serverMoveSource(table)) {
    return canShiftServerRow(table, (row as MoveRow).id, 'out')
  }
  if (isClientGrouped(table)) return false
  const parent = (row as MoveRow).getParentRow()
  return !!parent && parent.depth === 0
}

/** Подстрока встаёт в корень сразу после родителя. */
export const unnestRow = (row: unknown, table: unknown) => {
  if (!canUnnestRow(row, table)) {
    return
  }
  const r = row as MoveRow
  if (serverMoveSource(table)) {
    shiftServerRow(table, r.id, 'out')
    return
  }
  const parent = r.getParentRow()!
  const shown = rowsOf<MoveRow>(table, 'shown').rows
  const dragIndex = shown.findIndex(item => item.id === r.id)
  const hoverIndex = shown.findIndex(item => item.id === parent.id)
  commit(
    table,
    r,
    { index: positionOf(parent) + 1 },
    dragIndex,
    hoverIndex,
    () =>
      onRowOrderChangeOf(table)?.(prev => {
        const parentIndex = prev.findIndex(item => item.id === parent.id)
        const item = prev[parentIndex]?.subRows?.[positionOf(r)]
        if (!item) {
          return prev
        }
        const next = prev.map(entry =>
          entry.id === parent.id
            ? {
                ...entry,
                subRows: entry.subRows!.filter((_, i) => i !== positionOf(r)),
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

/** Вынуть строку с id из списка или подстрок любой глубины. */
const takeItem = (
  items: OrderItem[],
  rowId: string,
): [OrderItem[], OrderItem | undefined] => {
  const at = items.findIndex(item => item.id === rowId)
  if (at >= 0) return [items.filter((_, i) => i !== at), items[at]]
  for (let i = 0; i < items.length; i++) {
    const subRows = items[i]!.subRows
    if (!subRows) continue
    const [rest, item] = takeItem(subRows, rowId)
    if (item) {
      const next = [...items]
      next[i] = { ...items[i]!, subRows: rest }
      return [next, item]
    }
  }
  return [items, undefined]
}

/** Поставить строку на место среди подстрок `parentId` или в корень. */
const putItem = (
  items: OrderItem[],
  item: OrderItem,
  parentId: string | undefined,
  index: number,
): OrderItem[] => {
  if (parentId === undefined) {
    const next = [...items]
    next.splice(Math.min(index, next.length), 0, item)
    return next
  }
  return items.map(entry =>
    entry.id === parentId
      ? {
          ...entry,
          subRows: putItem(entry.subRows ?? [], item, undefined, index),
        }
      : entry.subRows
        ? { ...entry, subRows: putItem(entry.subRows, item, parentId, index) }
        : entry,
  )
}

/**
 * Перенос строки на место от истории правок (ADR 0222, §13): тот же путь, что бросок, —
 * колбэк, ожидание, ленивая стадия; данные пишутся по id строки.
 */
export const moveRowToPlace = (
  table: unknown,
  rowId: string,
  place: { parentId?: string; index: number },
  history: 'undo' | 'redo',
) => {
  const source = rowsOf<MoveRow>(table, 'core')
  const all = (
    table as { getRowSource: () => { byId: (id: string) => unknown } }
  ).getRowSource()
  const row = all.byId(rowId) as MoveRow | undefined
  if (!row) return false
  const parent =
    place.parentId === undefined
      ? undefined
      : (all.byId(place.parentId) as MoveRow | undefined)
  if (place.parentId !== undefined && !parent) return false
  const siblings = parent?.subRows ?? source.rows
  const shown = rowsOf<MoveRow>(table, 'shown').rows
  const target = siblings.filter(item => item.id !== rowId)[place.index]
  const dragIndex = shown.findIndex(item => item.id === rowId)
  const hoverIndex = shown.findIndex(
    item => item.id === (target?.id ?? parent?.id ?? rowId),
  )
  commit(
    table,
    row,
    { parent, index: place.index },
    dragIndex,
    hoverIndex,
    () =>
      onRowOrderChangeOf(table)?.(prev => {
        const [rest, item] = takeItem(prev, rowId)
        if (!item) return prev
        const moved =
          item.parentId === place.parentId
            ? item
            : { ...item, parentId: place.parentId }
        return putItem(rest, moved, place.parentId, place.index)
      }),
    history,
  )
  if (parent && !parent.getIsExpanded?.()) expand(parent)
  return true
}
