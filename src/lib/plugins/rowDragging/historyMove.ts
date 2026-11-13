/**
 * Исполнитель переноса для истории правок (ADR 0222, §13): обратный перенос идёт тем же путём,
 * что бросок, — кэш серверной модели (ADR 0159), значения клиентских групп (ADR 0186), данные и
 * ленивая стадия клиента (ADR 0112). Место строки — родитель и место среди сестёр.
 */
import type { RowMover, RowPlace } from '../../core/cellWrites'
import { readPluginHooks } from '../../core/definePlugin'
import { positionOf } from '../../core/rowPosition'
import { rowSourceOf } from '../../core/rowSource'
import { commitGroupMove, isClientGrouped } from './groupMove'
import { dragRowsOf } from './dragRows'
import { moveRowToPlace } from './moveRow'
import { commitServerMove, serverMoveSource } from './serverMove'
import type { RowDraggingHooks } from './types'

interface PlacedRow {
  id: string
  parentId?: string
  getParentRow?: () => { id: string } | undefined
}

const onRowDragEndOf = (table: unknown) =>
  readPluginHooks<Partial<RowDraggingHooks>>(table as never, 'rowDragging')
    .onRowDragEnd

const placeOf = (table: unknown, rowId: string): RowPlace | undefined => {
  const row = rowSourceOf(table).byId(rowId) as PlacedRow | undefined
  if (!row) return undefined
  const parentId = row.getParentRow?.()?.id ?? row.parentId
  // У клиентской группы место строки задаёт группировка, а не порядок: важен только родитель.
  const index = isClientGrouped(table) ? -1 : positionOf(row as never)
  return { ...(parentId !== undefined && { parentId }), index }
}

const move = (
  table: unknown,
  rowId: string,
  place: RowPlace,
  history: 'undo' | 'redo',
) => {
  const server = serverMoveSource(table)
  if (server) {
    if (!server.byId(rowId)) return false
    const offset = server.offset?.() ?? 0
    const from = server.listIndexOf!(rowId) - offset
    commitServerMove(
      table,
      rowId,
      { from, to: from },
      place,
      onRowDragEndOf(table),
      history,
    )
    return true
  }
  if (isClientGrouped(table)) {
    const source = rowSourceOf(table)
    const row = source.byId(rowId)
    const group = place.parentId ? source.byId(place.parentId) : undefined
    if (!row || !group) return false
    const rows = dragRowsOf(table)
    commitGroupMove(
      table,
      row as never,
      group as never,
      { from: rows.indexOf(rowId), to: rows.indexOf(place.parentId!) },
      onRowDragEndOf(table),
      history,
    )
    return true
  }
  return moveRowToPlace(table, rowId, place, history)
}

export const rowMover: RowMover = { move, placeOf }
