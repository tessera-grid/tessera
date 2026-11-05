/**
 * Итог переноса строки (ADR 0112): колбэк `onRowDragEnd` с местом после переноса,
 * ожидание его промиса, запись ленивого переноса в ответы и `data`, отказ — вспышка ручки
 * и объявление. Общий путь броска, клавиатуры и меню ручки.
 */
import { reportOutcome } from '../../core/debugActions'
import { announceLabel, announcerLabels } from '../../core/announcer'
import { ENGLISH_LABELS } from '../../core/localization'
import {
  type Answers,
  hasLazyMoves,
  type LazyRowMove,
  readRowMoves,
  type RowMoveEntry,
  type RowMoves,
  rowIdOf,
  updateChildren,
  withoutRow,
  withRowNear,
} from '../../shared/rowMoves'
import type { RenderVersionAtom } from '../../core/renderVersion'
import { inOneCommit } from '../../util/oneCommit'
import { isThenable, rejectionText } from '../../util/thenable'
import type { RowMoveFailed } from './rowDraggingFeature'
import { flashOutcome } from '../../core/flashes/flashFeature'
import { withoutFailure } from '../../shared/failedAttempts'
import type { RowDraggingHooks } from './types'
import { rowDraggingLabels } from './labels'

type Updater<T> = (prev: T) => T

interface MoveTable {
  options: {
    onRowOrderChange?: (updater: Updater<any[]>) => void
    /** Откатывать перенос при отказе промиса (ADR 0114, §4). */
    rowDragRevertOnReject?: boolean
  }
  atoms: { loadedChildren?: { get: () => Answers } }
  setRowMoves?: (updater: Updater<RowMoves>) => void
  setRowMoveFailed?: (updater: Updater<RowMoveFailed>) => void
  setLoadedChildren?: (rowId: string, rows: Updater<readonly unknown[]>) => void
}

export interface RowMoveCommit {
  rowId: string
  dragIndex: number
  hoverIndex: number
  parentId?: string
  previousParentId?: string
  index: number
  /** Ленивый перенос — стадия модели до итога; иначе `write` пишет в `data` сразу. */
  lazy?: LazyRowMove
  write?: () => void
  /** Откат при отказе вместо записи в `data` по id: перенос в кэше серверной модели. */
  revert?: () => void
  /** Объект данных строки и id сестёр модели на новом месте (без неё). */
  original?: unknown
  anchors?: readonly string[]
  /** Id сестёр и место строки до переноса — для отката по id (ADR 0114, §4). */
  fromAnchors?: readonly string[]
  fromIndex?: number
  /** Значения колонок группировки групп после и до переноса (ADR 0159, §5). */
  groupValues?: Record<string, unknown>
  previousGroupValues?: Record<string, unknown>
  /** Перенос между клиентскими группами: стадия до итога промиса (ADR 0186, §3). */
  group?: Record<string, unknown>
}

const withoutEntry = (moves: RowMoves, rowId: string): RowMoves => {
  if (!(rowId in moves)) {
    return moves
  }
  const next = { ...moves }
  delete next[rowId]
  return next
}

export const dropRowMove = (table: unknown, rowId: string) =>
  (table as MoveTable).setRowMoves?.(prev => withoutEntry(prev, rowId))

interface DataMove {
  rowId: string
  from?: string
  to?: string
  anchors: readonly string[]
  index: number
  original: unknown
}

/**
 * Перенос в `data` по id: строка уходит от родителя `from` и встаёт у родителя `to` рядом с
 * той же сестрой, что в модели. Так пишется обычный перенос, пока ждут ленивые (индексы
 * модели включают строки стадии), и откат при отказе.
 */
const writeDataMove = (table: MoveTable, move: DataMove) => {
  const idOf = rowIdOf(table)
  const { rowId, from, to } = move
  table.options.onRowOrderChange?.(prev => {
    const removed = updateChildren(prev, from, idOf, rows =>
      withoutRow(rows, rowId, idOf, from),
    )
    return updateChildren(removed, to, idOf, rows =>
      withRowNear(
        rows,
        move.anchors,
        move.index,
        move.original,
        rowId,
        idOf,
        to,
      ),
    ) as any[]
  })
}

const answersOf = (table: MoveTable): Answers =>
  table.atoms.loadedChildren?.get() ?? {}

/** Убрать строку со старого места ленивого переноса. */
const writeSource = (table: MoveTable, rowId: string, move: LazyRowMove) => {
  const idOf = rowIdOf(table)
  const { from } = move
  if (from.lazy) {
    table.setLoadedChildren?.(from.parentId!, rows =>
      withoutRow(rows, rowId, idOf, from.parentId),
    )
    return
  }
  table.options.onRowOrderChange?.(
    prev =>
      updateChildren(prev, from.parentId, idOf, rows =>
        withoutRow(rows, rowId, idOf, from.parentId),
      ) as any[],
  )
}

/** Поставить строку на новое место; `false` — ответа цели ещё нет (§4). */
export const writeTarget = (
  table: unknown,
  rowId: string,
  move: LazyRowMove,
): boolean => {
  const t = table as MoveTable
  const idOf = rowIdOf(table)
  const { to, original } = move
  if (to.lazy) {
    if (!(to.parentId! in answersOf(t))) {
      return false
    }
    t.setLoadedChildren?.(to.parentId!, rows =>
      withRowNear(
        rows,
        to.anchors ?? [],
        to.index,
        original,
        rowId,
        idOf,
        to.parentId,
      ),
    )
    return true
  }
  t.options.onRowOrderChange?.(
    prev =>
      updateChildren(prev, to.parentId, idOf, rows =>
        withRowNear(
          rows,
          to.anchors ?? [],
          to.index,
          original,
          rowId,
          idOf,
          to.parentId,
        ),
      ) as any[],
  )
  return true
}

/** Перенос записан: ленивый пишется, без ответа цели — ждёт его. */
const confirm = (table: MoveTable, rowId: string, entry: RowMoveEntry) => {
  const move = entry.lazy
  if (!move) {
    dropRowMove(table, rowId)
    return
  }
  writeSource(table, rowId, move)
  if (writeTarget(table, rowId, move)) {
    dropRowMove(table, rowId)
    return
  }
  table.setRowMoves?.(prev => ({
    ...prev,
    [rowId]: { ...entry, pending: false },
  }))
}

/**
 * Отказ (ADR 0114, §4): при `revertOnReject` ленивый перенос снимается, обычный —
 * откатывается в `data` по id; без отката ленивый записывается, как при успехе. Ручка
 * вспыхивает, строка — `reverted` там, где оказалась (ADR 0134), отказ объявляется.
 */
const reject = (
  table: MoveTable,
  commit: RowMoveCommit,
  entry: RowMoveEntry,
  reason: unknown,
) => {
  const { rowId } = commit
  const revert = table.options.rowDragRevertOnReject !== false
  if (entry.lazy && !revert) {
    confirm(table, rowId, entry)
  } else {
    dropRowMove(table, rowId)
  }
  if (!entry.lazy && revert && commit.revert) {
    commit.revert()
  } else if (!entry.lazy && revert) {
    writeDataMove(table, {
      rowId,
      from: commit.parentId,
      to: commit.previousParentId,
      anchors: commit.fromAnchors ?? [],
      index: commit.fromIndex ?? 0,
      original: commit.original,
    })
  }
  flashOutcome(table, { row: rowId }, 'reverted')
  table.setRowMoveFailed?.(prev => ({
    ...prev,
    [rowId]: { attempt: entry.attempt, error: reason },
  }))
  const labels = announcerLabels(table) ?? ENGLISH_LABELS
  const error = rejectionText(reason) ?? rowDraggingLabels(labels).moveRowFailed
  announceLabel(table, all => rowDraggingLabels(all).announceMoveFailed(error))
}

/**
 * Стадия меняет значение ячейки без смены данных, а ячейки запомнены по строке: версия
 * отрисовки заставляет их перечитать значение (ADR 0186, §3).
 */
const refreshStagedCells = (table: unknown) => {
  const version = (
    table as { options: { pluginRenderVersion?: RenderVersionAtom } }
  ).options.pluginRenderVersion
  version?.set(version.get() + 1)
}

// Номер попытки сквозной: итог прежнего переноса не спутать с новым.
let lastAttempt = 0

/**
 * Перенос сделан: обычный пишется в `data`, ленивый становится стадией модели; строка
 * вспыхивает `arrived` (ADR 0110, ADR 0134), колбэк получает место после переноса. Промис колбэка — ожидание
 * на ручке, его итог — запись ленивого переноса или отказ (ADR 0112, §3).
 */
export const commitRowMove = (
  table: unknown,
  commit: RowMoveCommit,
  onRowDragEnd: RowDraggingHooks['onRowDragEnd'] | undefined,
) => {
  const t = table as MoveTable
  const { rowId, lazy } = commit
  // Новый перенос строки — повтор: отметка прошлого отказа снимается (IR13).
  t.setRowMoveFailed?.(prev => withoutFailure(prev, rowId))
  if (!lazy) {
    if (hasLazyMoves(readRowMoves(table))) {
      writeDataMove(t, {
        rowId,
        from: commit.previousParentId,
        to: commit.parentId,
        anchors: commit.anchors ?? [],
        index: commit.index,
        original: commit.original,
      })
    } else commit.write?.()
  }
  flashOutcome(table, { row: rowId }, 'arrived')
  const result = onRowDragEnd?.({
    rowId,
    dragIndex: commit.dragIndex,
    hoverIndex: commit.hoverIndex,
    parentId: commit.parentId,
    previousParentId: commit.previousParentId,
    index: commit.index,
    ...(commit.groupValues && {
      groupValues: commit.groupValues,
      previousGroupValues: commit.previousGroupValues,
    }),
  })
  // Итог — с причиной: броском, клавишей или пунктом меню ручки этой задачи (ADR 0125).
  reportOutcome(table, { plugin: 'rowDragging', action: 'commitMove' }, result)
  const attempt = ++lastAttempt
  if (!isThenable(result)) {
    if (lazy) {
      confirm(t, rowId, { attempt, pending: false, lazy })
    }
    return
  }
  const entry: RowMoveEntry = {
    attempt,
    pending: true,
    lazy,
    group: commit.group,
  }
  t.setRowMoves?.(prev => ({ ...prev, [rowId]: entry }))
  if (commit.group) refreshStagedCells(table)
  const settle = (ok: boolean, reason?: unknown) => {
    if (readRowMoves(table)[rowId]?.attempt !== attempt) {
      return
    }
    if (ok) {
      confirm(t, rowId, entry)
      flashOutcome(table, { row: rowId }, 'accepted')
    } else {
      reject(t, commit, entry, reason)
    }
    if (commit.group) refreshStagedCells(table)
  }
  // Стадия модели и `data` приложения меняются одним коммитом: строка не пропадает.
  result.then(
    () => inOneCommit(() => settle(true)),
    reason => inOneCommit(() => settle(false, reason)),
  )
}
