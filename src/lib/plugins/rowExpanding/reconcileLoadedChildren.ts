/**
 * Согласование ленивых детей со сменой данных (ADR 0054, §2): ответ строки, ушедшей из
 * данных, и пустой ответ удаляются, ожидание ушедшей строки снимается (её поздний ответ
 * не применится), как и отметки прихода (ADR 0056); ответы оставшихся строк живут
 * по id.
 */
import {
  readLoadedChildren,
  readRowArrivals,
  setLoadedAnswer,
} from './lazyChildrenFeature'
import { dropArrivals } from './rowArrivals'
import type { RowExpandPending } from './rowExpandingPendingFeature'

interface ReconcileTable {
  store: object
  options: { data: unknown }
  atoms: { rowExpandPending?: { get: () => RowExpandPending } }
  getCoreRowModel: () => { rowsById: Record<string, unknown> }
  setRowExpandPending?: (
    updater: (prev: RowExpandPending) => RowExpandPending,
  ) => void
}

const lastData = new WeakMap<object, unknown>()

// Предел вложенности: удалённый ответ родителя уносит строки ответов внутри него.
const MAX_PASSES = 16

const without = <T>(record: Record<string, T>, ids: readonly string[]) => {
  const next = { ...record }
  ids.forEach(id => delete next[id])
  return next
}

export const reconcileLoadedChildren = (table: unknown) => {
  const t = table as ReconcileTable
  const previous = lastData.get(t.store)
  lastData.set(t.store, t.options.data)
  if (previous === undefined || previous === t.options.data) {
    return
  }
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const loaded = readLoadedChildren(table)
    const { rowsById } = t.getCoreRowModel()
    const stale = Object.keys(loaded).filter(
      id => !rowsById[id] || loaded[id]!.length === 0,
    )
    if (stale.length === 0) {
      break
    }
    setLoadedAnswer(table, prev => without(prev, stale))
  }
  const { rowsById } = t.getCoreRowModel()
  const gone = Object.keys(t.atoms.rowExpandPending?.get() ?? {}).filter(
    id => !rowsById[id],
  )
  if (gone.length > 0) {
    t.setRowExpandPending?.(prev => without(prev, gone))
  }
  dropArrivals(
    table,
    Object.keys(readRowArrivals(table)).filter(id => !rowsById[id]),
  )
}
