/**
 * Перенос строки в серверной модели (ADR 0159, §2, §4, §6): бросок, меню ручки и клавиши.
 * Строка сразу встаёт на новое место в кэше транзакцией источника, итог тот же;
 * `onRowDragEnd` получает место в ветке, отказ промиса возвращает строку.
 */
import { reportAction } from '../../core/debugActions'
import { readPluginHooks } from '../../core/definePlugin'
import { groupKeysOf, type RowSource, rowSourceOf } from '../../core/rowSource'
import {
  commitRowMove,
  dropRowMove,
  markMoveFailed,
  markMoveWaiting,
} from './commitRowMove'
import { canNestInto } from './draggingHelpers'
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

interface BranchRow extends PlacedRow {
  id: string
  groupingColumnId?: string
  setExpandedByUser?: (expanded: boolean) => void
  toggleExpanded?: (expanded?: boolean) => void
}

/** Сторона смены уровня: «внутрь» — вложить или в следующую группу, «наружу» — вынести или в предыдущую. */
export type ServerRowShift = 'in' | 'out'

const groupingOf = (table: unknown) =>
  (
    table as { atoms: { grouping?: { get: () => string[] } } }
  ).atoms.grouping?.get() ?? []

export const isServerGrouped = (table: unknown) =>
  !!serverMoveSource(table) && groupingOf(table).length > 0

/** Ветка, куда уходит строка: предыдущая сестра-ветка или соседняя группа (ADR 0189, §1, §5). */
const branchTargetOf = (
  table: unknown,
  source: RowSource,
  row: BranchRow,
  shift: ServerRowShift,
): BranchRow | undefined => {
  if (row.groupingColumnId !== undefined) return undefined
  if (groupingOf(table).length > 0) {
    const group = source.byId(row.parentId ?? '') as BranchRow | undefined
    if (group?.groupingColumnId === undefined) return undefined
    const next = source.rowIn?.(
      group.parentId,
      group.index + (shift === 'in' ? 1 : -1),
    ) as BranchRow | undefined
    return next?.groupingColumnId === undefined ? undefined : next
  }
  if (shift === 'out') return undefined
  const sister = source.rowIn?.(row.parentId, row.index - 1) as
    BranchRow | undefined
  return sister && canNestInto(sister, table) ? sister : undefined
}

/** Вынос: место сразу за родителем, на его уровне (ADR 0189, §1). */
const outdentPlaceOf = (
  table: unknown,
  source: RowSource,
  row: BranchRow,
): (ServerMovePlace & { parent: BranchRow }) | undefined => {
  if (groupingOf(table).length > 0 || row.parentId === undefined)
    return undefined
  const parent = source.byId(row.parentId) as BranchRow | undefined
  return (
    parent && { parentId: parent.parentId, index: parent.index + 1, parent }
  )
}

/** Строку можно вложить, вынести или перенести в соседнюю группу. */
export const canShiftServerRow = (
  table: unknown,
  rowId: string,
  shift: ServerRowShift,
) => {
  const source = serverMoveSource(table)
  const row = source?.byId(rowId) as BranchRow | undefined
  if (!source || !row) return false
  return (
    !!branchTargetOf(table, source, row, shift) ||
    (shift === 'out' && !!outdentPlaceOf(table, source, row))
  )
}

/** Строка становится последней при известном итоге ветки, иначе первой (ADR 0189, §2). */
const endOfBranch = (source: RowSource, parentId: string) => {
  const branch = source.branchSize?.(parentId)
  return branch?.known ? branch.count : 0
}

/** Строки ветки пришли: число строк группы известно и до них (ADR 0144, §2). */
const branchReady = (source: RowSource, parentId: string) => {
  const branch = source.branchSize?.(parentId)
  return (
    !!branch &&
    (!!source.rowIn?.(parentId, 0) || (branch.known && branch.count === 0))
  )
}

const waits = new WeakMap<object, () => void>()

/** Цель свёрнута: раскрыть, дождаться строк, затем `go`; отказ ветки отменяет перенос (§3). */
const whenBranchReady = (
  table: unknown,
  source: RowSource,
  rowId: string,
  target: BranchRow,
  go: () => void,
) => {
  const { store } = table as {
    store: { subscribe: (listener: () => void) => { unsubscribe: () => void } }
  }
  waits.get(store)?.()
  if (branchReady(source, target.id)) {
    go()
    return
  }
  if (target.setExpandedByUser) target.setExpandedByUser(true)
  else target.toggleExpanded?.(true)
  markMoveWaiting(table, rowId)
  reportAction(table, {
    plugin: 'rowDragging',
    action: 'awaitBranch',
    detail: { rowId, parentId: target.id },
    source: 'auto',
  })
  const epoch = source.epoch?.()
  let opened = false
  const stop = () => {
    subscription.unsubscribe()
    waits.delete(store)
    dropRowMove(table, rowId)
  }
  const check = () => {
    const current = rowSourceOf(table)
    const branch = current.branchSize?.(target.id)
    opened ||= !!branch
    if (
      !current.byId(rowId) ||
      current.epoch?.() !== epoch ||
      (opened && !branch)
    ) {
      stop()
      return
    }
    const first = current.indexOf(target.id) + 1
    const failure = current.failures?.().find(each => each.start === first)
    if (failure) {
      stop()
      queueMicrotask(() => markMoveFailed(table, rowId, 0, failure.reason))
      return
    }
    if (branchReady(current, target.id)) {
      stop()
      // Запись в источник посреди оповещения хранилища теряет перерисовку строк.
      queueMicrotask(go)
    }
  }
  const subscription = store.subscribe(check)
  waits.set(store, stop)
}

/** Перенос на место `place`; `hoverId` — строка места для `hoverIndex` колбэка. */
const moveTo = (
  table: unknown,
  rowId: string,
  hoverId: string,
  place: ServerMovePlace,
) => {
  const source = serverMoveSource(table)
  if (!source) return
  const offset = source.offset?.() ?? 0
  commitServerMove(
    table,
    rowId,
    {
      from: source.listIndexOf!(rowId) - offset,
      to: source.listIndexOf!(hoverId) - offset,
    },
    place,
    readPluginHooks<Partial<RowDraggingHooks>>(table as never, 'rowDragging')
      .onRowDragEnd,
  )
}

/** Вложить, вынести или перенести в соседнюю группу (ADR 0189). */
export const shiftServerRow = (
  table: unknown,
  rowId: string,
  shift: ServerRowShift,
) => {
  const source = serverMoveSource(table)
  const row = source?.byId(rowId) as BranchRow | undefined
  if (!source || !row) return
  const target = branchTargetOf(table, source, row, shift)
  if (target) {
    whenBranchReady(table, source, rowId, target, () =>
      moveTo(table, rowId, target.id, {
        parentId: target.id,
        index: endOfBranch(rowSourceOf(table), target.id),
      }),
    )
    return
  }
  const outdent =
    shift === 'out' ? outdentPlaceOf(table, source, row) : undefined
  if (outdent) {
    const { parent, ...place } = outdent
    moveTo(table, rowId, parent.id, place)
  }
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
  // Перенос за окно уносит строку из кэша: откат ставит её по данным и закрывает новое место
  // (ADR 0159, §2).
  const stray = row && { original: row.original, from: place }
  const grouping = groupingOf(table)
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
      revert: () => source.moveRow?.(rowId, before, stray),
    },
    onRowDragEnd,
  )
}
