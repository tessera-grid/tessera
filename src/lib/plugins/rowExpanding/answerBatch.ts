/**
 * Склейка ответов `loadChildren` (ADR 0066): успешные асинхронные ответы копятся до
 * кадра и применяются задачей сразу после него одной записью срезов — одна пересборка
 * модели на пачку.
 */
import { batch } from '@tanstack/react-store'

import { announceLabel } from '../../core/announcer'
import { flashOutcome } from '../../core/flashes/flashFeature'
import { readLoadedChildren, setLoadedAnswer } from './lazyChildrenFeature'
import type { RowExpandPending } from './rowExpandingPendingFeature'
import { rowExpandingLabels } from './labels'

export interface BatchTable {
  store: object
  getCoreRowModel: () => {
    rowsById: Record<string, { subRows: { id: string }[] } | undefined>
  }
  atoms: { rowExpandPending?: { get: () => RowExpandPending } }
  setRowExpandPending?: (
    updater: (prev: RowExpandPending) => RowExpandPending,
  ) => void
}

interface Answer {
  rowId: string
  attempt: number
  rows: unknown
  /** Сохранённый ответ строки на момент прихода: другой при применении — его записало приложение. */
  saved: readonly unknown[] | undefined
}

/** Применение пачки, если кадра нет (вкладка скрыта), мс. */
export const HIDDEN_TAB_FALLBACK_MS = 100

const queues = new WeakMap<object, Answer[]>()

export const childIds = (table: BatchTable, rowId: string) =>
  (table.getCoreRowModel().rowsById[rowId]?.subRows ?? []).map(row => row.id)

const asRows = (rows: unknown): readonly unknown[] =>
  Array.isArray(rows) ? rows : []

const apply = (table: BatchTable, answers: readonly Answer[]) => {
  const pending = table.atoms.rowExpandPending?.get() ?? {}
  const current = answers.filter(
    answer => pending[answer.rowId] === answer.attempt,
  )
  if (current.length === 0) {
    return
  }
  const loaded = readLoadedChildren(table)
  const fresh = current.filter(answer => loaded[answer.rowId] === answer.saved)
  // Дети до записи — по модели прошлого рендера: снятие ожидания убирает скелет-строку
  // (ADR 0155), чтение после него пересобрало бы модель лишний раз.
  const before = fresh.map(answer => new Set(childIds(table, answer.rowId)))
  // Ожидание и ответ — одним уведомлением: модель собирается раз на пачку (ADR 0066).
  batch(() => {
    table.setRowExpandPending?.(prev => {
      const next = { ...prev }
      current.forEach(answer => delete next[answer.rowId])
      return next
    })
    if (fresh.length === 0) return
    setLoadedAnswer(table, prev => {
      const next = { ...prev }
      fresh.forEach(answer => (next[answer.rowId] = asRows(answer.rows)))
      return next
    })
  })
  if (fresh.length === 0) {
    return
  }
  let count = 0
  const arrived = fresh.flatMap((answer, i) => {
    const after = childIds(table, answer.rowId)
    count += after.length
    return after.filter(id => !before[i]!.has(id))
  })
  flashOutcome(
    table,
    arrived.map(row => ({ row })),
    'arrived',
  )
  announceLabel(table, all =>
    rowExpandingLabels(all).announceChildrenLoaded(count),
  )
}

/** Поставить успешный асинхронный ответ строки в очередь таблицы до кадра. */
export const enqueueAnswer = (
  table: BatchTable,
  rowId: string,
  attempt: number,
  rows: unknown,
) => {
  const answer = {
    rowId,
    attempt,
    rows,
    saved: readLoadedChildren(table)[rowId],
  }
  const queued = queues.get(table.store)
  if (queued) {
    queued.push(answer)
    return
  }
  const answers = [answer]
  queues.set(table.store, answers)
  let frame: number | undefined
  let afterFrame: ReturnType<typeof setTimeout> | undefined
  const run = () => {
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
    }
    clearTimeout(timer)
    clearTimeout(afterFrame)
    queues.delete(table.store)
    apply(table, answers)
  }
  const timer = setTimeout(run, HIDDEN_TAB_FALLBACK_MS)
  // Применение — задачей сразу после кадра: пересборка не задерживает кадр и не
  // склеивается с его раскладкой в одну длинную задачу.
  if (typeof requestAnimationFrame === 'function') {
    frame = requestAnimationFrame(() => {
      frame = undefined
      afterFrame = setTimeout(run, 0)
    })
  }
}
