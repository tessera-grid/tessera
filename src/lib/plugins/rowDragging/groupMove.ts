/**
 * Перенос строки между группами клиентской группировки (ADR 0186): бросок и меню ручки.
 * Значение пишет приложение по `onRowDragEnd`, до итога промиса строка стоит в новой группе
 * стадией модели группировки.
 */
import { readPluginHooks } from '../../core/definePlugin'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import type { Row } from '../../types'
import { commitRowMove } from './commitRowMove'
import { dragRowsOf, groupedRowsOf } from './dragRows'
import type { RowDraggingHooks } from './types'
import { positionOf } from '../../core/rowPosition'

type AnyRow = Row<any, any>

interface GroupRow {
  groupingColumnId?: string
  groupingValue?: unknown
}

interface GroupTable {
  atoms: { grouping?: { get: () => readonly unknown[] } }
}

/** Клиентская группировка активна: строки переносятся только между группами. */
export const isClientGrouped = (table: unknown) =>
  !serverRowModelReason(table) &&
  ((table as GroupTable).atoms.grouping?.get().length ?? 0) > 0

/** Значения колонок группировки по пути строки-группы, от неё до корня. */
const groupValuesOf = (group: AnyRow | undefined) => {
  const values: Record<string, unknown> = {}
  for (let row = group; row; row = row.getParentRow()) {
    const { groupingColumnId, groupingValue } = row as GroupRow
    if (groupingColumnId !== undefined) values[groupingColumnId] = groupingValue
  }
  return values
}

/** Подпись группы: значения пути от корня. */
export const groupPathLabel = (group: AnyRow) => {
  const path: string[] = []
  for (let row: AnyRow | undefined = group; row; row = row.getParentRow()) {
    path.unshift(String((row as GroupRow).groupingValue))
  }
  return path.join(' / ')
}

/** Группы, куда можно перенести строку: того же уровня, кроме её группы. */
export const groupMoveTargets = (row: AnyRow, table: unknown): AnyRow[] => {
  const parent = row.getParentRow()
  if (!parent) return []
  return groupedRowsOf(table).filter(
    group =>
      (group as GroupRow).groupingColumnId !== undefined &&
      group.depth === parent.depth &&
      group.id !== parent.id,
  )
}

/** Место строки в группе: порядок внутри неё задают данные (ADR 0186, §2). */
const indexIn = (group: AnyRow, row: AnyRow) =>
  group.subRows.filter(sibling => positionOf(sibling) < positionOf(row)).length

export const commitGroupMove = (
  table: unknown,
  row: AnyRow,
  group: AnyRow,
  { from, to }: { from: number; to: number },
  onRowDragEnd: RowDraggingHooks['onRowDragEnd'] | undefined,
) => {
  const previous = row.getParentRow()
  const groupValues = groupValuesOf(group)
  commitRowMove(
    table,
    {
      rowId: row.id,
      dragIndex: from,
      hoverIndex: to,
      parentId: group.id,
      previousParentId: previous?.id,
      index: indexIn(group, row),
      groupValues,
      previousGroupValues: groupValuesOf(previous),
      group: groupValues,
      // Данные не менялись: откат — снятие стадии.
      revert: () => {},
    },
    onRowDragEnd,
  )
}

/** Перенос пунктом меню ручки: тот же путь, что бросок. */
export const moveRowToGroup = (table: unknown, row: AnyRow, group: AnyRow) => {
  const rows = dragRowsOf(table)
  commitGroupMove(
    table,
    row,
    group,
    { from: rows.indexOf(row.id), to: rows.indexOf(group.id) },
    readPluginHooks<Partial<RowDraggingHooks>>(table as never, 'rowDragging')
      .onRowDragEnd,
  )
  if (!group.getIsExpanded()) group.toggleExpanded(true)
}
