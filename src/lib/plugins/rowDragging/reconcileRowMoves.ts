/**
 * Согласование переносов в ожидании (ADR 0112, §4, §6): после каждого рендера.
 * Подтверждённый перенос без ответа цели ждёт его — пришёл ответ, строка встаёт в него;
 * загрузка не идёт и ответа нет — перенос снимается. Строка или родитель, ушедшие из
 * модели, снимают перенос без записи. Без переносов — ничего.
 */
import {
  type Answers,
  childrenOf,
  readRowMoves,
  rowIdOf,
} from '../../shared/rowMoves'
import { dropRowMove, writeTarget } from './commitRowMove'
import { type FailedAttempts, withoutGone } from '../../shared/failedAttempts'
import { serverMoveSource } from './serverMove'

interface ReconcileTable {
  options: { data: readonly unknown[] }
  atoms: {
    rowMoveFailed?: { get: () => FailedAttempts }
    loadedChildren?: { get: () => Answers }
    rowExpandPending?: { get: () => Record<string, number> }
  }
  getCoreRowModel: () => { rowsById: Record<string, unknown> }
}

/** Источник переноса на момент проверки: строки, ушедшие из него, ищутся при смене. */
const checked = new WeakMap<object, { data: unknown; answers: unknown }>()

const containsRow = (
  rows: readonly unknown[] | undefined,
  rowId: string,
  table: unknown,
  parentId?: string,
) => {
  const idOf = rowIdOf(table)
  return !!rows?.some((item, i) => idOf(item, i, parentId) === rowId)
}

/**
 * Строка в модели: в серверной модели строк — в кэше источника, в модели TanStack её нет
 * (ADR 0159, §2).
 */
const knownRows = (table: unknown) => {
  const { rowsById } = (table as ReconcileTable).getCoreRowModel()
  const server = serverMoveSource(table)
  return (id: string) => !!rowsById[id] || !!server?.byId(id)
}

/** Отметка отказа строки, ушедшей из модели, снимается (IR14). */
const pruneFailures = (table: unknown) => {
  const t = table as ReconcileTable & {
    setRowMoveFailed?: (
      updater: (prev: FailedAttempts) => FailedAttempts,
    ) => void
  }
  const failed = t.atoms.rowMoveFailed?.get()
  if (!failed || Object.keys(failed).length === 0) return
  t.setRowMoveFailed?.(prev => withoutGone(prev, knownRows(table)))
}

export const reconcileRowMoves = (table: unknown) => {
  pruneFailures(table)
  const moves = readRowMoves(table)
  let any = false
  for (const _ in moves) {
    any = true
    break
  }
  if (!any) {
    return
  }
  const t = table as ReconcileTable
  const answers = t.atoms.loadedChildren?.get() ?? {}
  const { rowsById } = t.getCoreRowModel()
  const known = knownRows(table)
  const seen = checked.get(t.atoms)
  const inputsChanged =
    !seen || seen.data !== t.options.data || seen.answers !== answers
  checked.set(t.atoms, { data: t.options.data, answers })

  for (const rowId in moves) {
    const entry = moves[rowId]!
    const move = entry.lazy
    if (!move) {
      // Перенос серверной модели снимает только его итог: за окном строки в кэше нет.
      if (!known(rowId) && !serverMoveSource(table)) dropRowMove(table, rowId)
      continue
    }
    const { from, to } = move
    const parentGone =
      (to.parentId !== undefined && !rowsById[to.parentId]) ||
      (entry.pending && from.parentId !== undefined && !rowsById[from.parentId])
    // Пока промис не выполнен, строка стоит на старом месте источника: ушла — снять.
    const rowGone =
      entry.pending &&
      inputsChanged &&
      !containsRow(
        from.lazy
          ? answers[from.parentId!]
          : childrenOf(t.options.data, from.parentId, rowIdOf(table)),
        rowId,
        table,
        from.parentId,
      )
    if (parentGone || rowGone) {
      dropRowMove(table, rowId)
      continue
    }
    if (entry.pending || !to.lazy) {
      continue
    }
    if (to.parentId! in answers) {
      writeTarget(table, rowId, move)
      dropRowMove(table, rowId)
    } else if (!t.atoms.rowExpandPending?.get()[to.parentId!]) {
      dropRowMove(table, rowId)
    }
  }
}
