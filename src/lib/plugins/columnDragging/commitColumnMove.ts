/**
 * Итог переноса колонки (ADR 0114): промис `onColumnDragEnd` — ожидание на ручке узла,
 * отказ — узел возвращается к прежним соседям по id, вспышка и объявление. Общий путь
 * броска, клавиатуры и меню ручки.
 */
import { announceLabel, announcerLabels } from '../../core/announcer'
import { DEFAULT_LABELS } from '../../core/localization'
import {
  type FlashOutcome,
  flashOutcome,
} from '../../core/flashes/flashFeature'
import { reportOutcome } from '../../core/debugActions'
import { isThenable, rejectionText } from '../../core/thenable'

/** Перенос узла в ожидании: его листья и соседи до переноса. */
export interface ColumnMoveEntry {
  attempt: number
  leaves: readonly string[]
  /** Колонки узла для вспышки: группа, её подгруппы и листья; без них — листья. */
  nodes?: readonly string[]
  /** Лист сразу за узлом до переноса. */
  before?: string
  /** Лист сразу перед узлом до переноса. */
  after?: string
}

export type ColumnMoves = Readonly<Record<string, ColumnMoveEntry>>
export type ColumnMoveFailed = Readonly<Record<string, number>>

type Updater<T> = (prev: T) => T

interface MoveTable {
  options: { columnDragRevertOnReject?: boolean }
  atoms: { columnMoves?: { get: () => ColumnMoves } }
  setColumnOrder: (updater: Updater<string[]>) => void
  setColumnMoves?: (updater: Updater<ColumnMoves>) => void
  setColumnMoveFailed?: (updater: Updater<ColumnMoveFailed>) => void
}

const NO_MOVES: ColumnMoves = {}

/** Вспышка итога узла (ADR 0134): заголовков группы и подгрупп и каждого листа. */
export const flashNode = (
  table: unknown,
  columns: readonly string[],
  outcome: FlashOutcome,
) =>
  flashOutcome(
    table,
    columns.map(column => ({ column })),
    outcome,
  )

export const readColumnMoves = (table: unknown): ColumnMoves =>
  (table as MoveTable).atoms.columnMoves?.get() ?? NO_MOVES

export const dropColumnMove = (table: unknown, columnId: string) =>
  (table as MoveTable).setColumnMoves?.(prev => {
    if (!(columnId in prev)) return prev
    const next = { ...prev }
    delete next[columnId]
    return next
  })

/**
 * Порядок с листьями узла у прежних соседей: перед листом, что стоял сразу за ним, иначе
 * после того, что стоял перед ним; соседей нет — в начало.
 */
export const restoreBlock = (
  order: readonly string[],
  {
    leaves,
    before,
    after,
  }: Pick<ColumnMoveEntry, 'leaves' | 'before' | 'after'>,
): string[] => {
  const rest = order.filter(id => !leaves.includes(id))
  const beforeAt = before === undefined ? -1 : rest.indexOf(before)
  const afterAt = after === undefined ? -1 : rest.indexOf(after)
  const at = beforeAt >= 0 ? beforeAt : afterAt >= 0 ? afterAt + 1 : 0
  return [...rest.slice(0, at), ...leaves, ...rest.slice(at)]
}

/** Соседи узла `leaves` в порядке `order` — для отката. */
export const neighboursOf = (
  order: readonly string[],
  leaves: readonly string[],
) => {
  const first = order.indexOf(leaves[0]!)
  const last = order.indexOf(leaves[leaves.length - 1]!)
  return { after: order[first - 1], before: order[last + 1] }
}

const reject = (
  table: MoveTable,
  columnId: string,
  entry: ColumnMoveEntry,
  reason: unknown,
) => {
  dropColumnMove(table, columnId)
  // Откат — выбор приложения (ADR 0114, §4); без него клиент остаётся с новым порядком.
  if (table.options.columnDragRevertOnReject !== false) {
    table.setColumnOrder(prev => restoreBlock(prev, entry))
  }
  flashNode(table, entry.nodes ?? entry.leaves, 'reverted')
  table.setColumnMoveFailed?.(prev => ({ ...prev, [columnId]: entry.attempt }))
  const labels = announcerLabels(table) ?? DEFAULT_LABELS
  const error = rejectionText(reason) ?? labels.moveColumnFailed
  announceLabel(table, all => all.announceColumnMoveFailed(error))
}

// Номер попытки сквозной: итог прежнего переноса не спутать с новым.
let lastAttempt = 0

/** Итог колбэка переноса узла `columnId`: промис — ожидание, отказ — откат (§1). */
export const settleColumnMove = (
  table: unknown,
  columnId: string,
  move: Omit<ColumnMoveEntry, 'attempt'>,
  result: unknown,
) => {
  // Итог — с причиной: броском, клавишей или пунктом меню ручки этой задачи (ADR 0125).
  reportOutcome(
    table,
    { plugin: 'columnDragging', action: 'commitMove' },
    result,
  )
  if (!isThenable(result)) return
  const t = table as MoveTable
  const entry: ColumnMoveEntry = { ...move, attempt: ++lastAttempt }
  t.setColumnMoves?.(prev => ({ ...prev, [columnId]: entry }))
  const settle = (ok: boolean, reason?: unknown) => {
    if (readColumnMoves(table)[columnId]?.attempt !== entry.attempt) return
    if (ok) {
      dropColumnMove(table, columnId)
      flashNode(table, entry.nodes ?? entry.leaves, 'accepted')
    } else reject(t, columnId, entry, reason)
  }
  result.then(
    () => settle(true),
    reason => settle(false, reason),
  )
}

/**
 * Узел, ушедший из модели — колонку скрыли или убрали из `columns`, — снимает ожидание:
 * поздний итог его промиса ничего не откатывает (§1). Без переносов — ничего.
 */
export const reconcileColumnMoves = (table: unknown) => {
  const moves = readColumnMoves(table)
  const ids = Object.keys(moves)
  if (ids.length === 0) return
  const columns = (
    table as {
      getAllFlatColumns: () => { id: string; getIsVisible: () => boolean }[]
    }
  ).getAllFlatColumns()
  for (const id of ids) {
    const column = columns.find(item => item.id === id)
    if (!column?.getIsVisible()) dropColumnMove(table, id)
  }
}
