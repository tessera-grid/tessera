import type { Row } from '../../types'
import { isThenable } from '../../core/thenable'
import type { RowExpandPending } from './rowExpandingPendingFeature'
import type { RowExpandingHooks } from './types'

type PendingRow = Row<any, any> & {
  getIsExpandPending?: () => boolean
  table: {
    atoms: { rowExpandPending?: { get: () => RowExpandPending } }
    setRowExpandPending?: (
      updater: (prev: RowExpandPending) => RowExpandPending,
    ) => void
  }
}

// Номер попытки сквозной: итог прежнего раскрытия не спутать с новым.
let lastAttempt = 0

/**
 * Переключить раскрытие и уведомить `onExpandRow` (общий путь клика и клавиши).
 * Промис при раскрытии — ожидание: повторное нажатие до итога игнорируется,
 * отказ сворачивает строку обратно (ADR 0041, §3).
 */
export const toggleRowExpanded = (
  row: Row<any, any>,
  hooks: Partial<RowExpandingHooks>,
): void => {
  const pendingRow = row as PendingRow
  if (pendingRow.getIsExpandPending?.()) {
    return
  }
  const expanding = !row.getIsExpanded()
  row.getToggleExpandedHandler()()
  const result = hooks.onExpandRow?.(row, expanding)
  const { table } = pendingRow
  const setPending = table.setRowExpandPending
  if (!expanding || !isThenable(result) || !setPending) {
    return
  }
  const attempt = ++lastAttempt
  setPending(prev => ({ ...prev, [row.id]: attempt }))
  const settle = (ok: boolean) => {
    if (table.atoms.rowExpandPending?.get()[row.id] !== attempt) {
      return
    }
    setPending(prev => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    if (!ok) {
      row.toggleExpanded(false)
    }
  }
  result.then(
    () => settle(true),
    () => settle(false),
  )
}
