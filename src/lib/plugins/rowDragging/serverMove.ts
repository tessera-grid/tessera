/**
 * Перенос строки в серверной модели (ADR 0159, §2, §4, §6): бросок, меню ручки и клавиши.
 * Строка сразу встаёт на новое место в кэше транзакцией источника, итог тот же;
 * `onRowDragEnd` получает место в ветке, отказ промиса возвращает строку.
 */
import { readPluginHooks } from '../../core/definePlugin'
import { groupKeysOf, type RowSource, rowSourceOf } from '../../core/rowSource'
import { commitRowMove } from './commitRowMove'
import type { RowDraggingHooks } from './types'

/** Источник серверной модели строк, если перенос идёт через него. */
export const serverMoveSource = (table: unknown) => {
  const source = (table as { getRowSource?: () => RowSource }).getRowSource?.()
  return source?.moveRow ? source : undefined
}

/** Край переноса меню ручки: начало или конец ветки. */
export type RowMoveEdge = 'start' | 'end'

/** Место строки: ветка (без родителя — корни) и индекс в ней. */
export interface ServerMovePlace {
  parentId?: string
  index: number
}

interface PlacedRow {
  index: number
  parentId?: string
}

/**
 * Место строки после переноса меню ручки или клавишей (ADR 0159, §6), в её ветке;
 * `undefined` — переносить некуда. «Вверх» и «вниз» — к соседу, края — по итогу ветки:
 * конец известен только с итогом.
 */
export const serverMoveTarget = (
  source: RowSource,
  rowId: string,
  to: -1 | 1 | RowMoveEdge,
): ServerMovePlace | undefined => {
  const row = source.byId(rowId) as PlacedRow | undefined
  const branch = row && source.branchSize?.(row.parentId)
  if (!row || !branch) return undefined
  const last = branch.count - 1
  const target =
    to === 'start'
      ? 0
      : to === 'end'
        ? branch.known
          ? last
          : undefined
        : row.index + to
  if (target === undefined || target < 0 || target > last) return undefined
  return target === row.index
    ? undefined
    : { parentId: row.parentId, index: target }
}

/** Перенос меню ручки или клавишей: тот же путь, что бросок. */
export const moveServerRow = (
  table: unknown,
  rowId: string,
  to: -1 | 1 | RowMoveEdge,
) => {
  const source = serverMoveSource(table)
  const place = source && serverMoveTarget(source, rowId, to)
  if (!source || !place) return
  const row = source.byId(rowId) as PlacedRow
  const from = source.listIndexOf!(rowId) - (source.offset?.() ?? 0)
  commitServerMove(
    table,
    rowId,
    { from, to: from + place.index - row.index },
    place,
    readPluginHooks<Partial<RowDraggingHooks>>(table as never, 'rowDragging')
      .onRowDragEnd,
  )
}

/** Значения колонок группировки по пути строки-группы `groupId` (ADR 0159, §5). */
const groupValuesOf = (
  groupId: string | undefined,
  grouping: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(
    groupKeysOf(groupId).map((value, level) => [grouping[level], value]),
  )

/**
 * Перенос строки на место `place`; `from` и `to` — строки броска в индексах страницы для
 * `onRowDragEnd`.
 */
export const commitServerMove = (
  table: unknown,
  rowId: string,
  { from, to }: { from: number; to: number },
  place: ServerMovePlace,
  onRowDragEnd: RowDraggingHooks['onRowDragEnd'] | undefined,
) => {
  const source = rowSourceOf(table)
  const row = source.byId(rowId) as
    (PlacedRow & { original?: unknown }) | undefined
  const before = { parentId: row?.parentId, index: row?.index ?? 0 }
  // Перенос за окно уносит строку из кэша: откат ставит её по данным (ADR 0159, §2).
  const original = row?.original
  const grouping =
    (
      table as { atoms: { grouping?: { get: () => string[] } } }
    ).atoms.grouping?.get() ?? []
  commitRowMove(
    table,
    {
      rowId,
      dragIndex: from,
      hoverIndex: to,
      parentId: place.parentId,
      previousParentId: before.parentId,
      index: place.index,
      ...(grouping.length > 0 && {
        groupValues: groupValuesOf(place.parentId, grouping),
        previousGroupValues: groupValuesOf(before.parentId, grouping),
      }),
      write: () => source.moveRow?.(rowId, place),
      revert: () => source.moveRow?.(rowId, before, original),
    },
    onRowDragEnd,
  )
}
