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
} from '../../core/rowMoves'
import { dropRowMove, writeTarget } from './commitRowMove'

interface ReconcileTable {
  options: { data: readonly unknown[] }
  atoms: {
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

export const reconcileRowMoves = (table: unknown) => {
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
  const seen = checked.get(t.atoms)
  const inputsChanged =
    !seen || seen.data !== t.options.data || seen.answers !== answers
  checked.set(t.atoms, { data: t.options.data, answers })

  for (const rowId in moves) {
    const entry = moves[rowId]!
    const move = entry.lazy
    if (!move) {
      if (!rowsById[rowId]) dropRowMove(table, rowId)
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
