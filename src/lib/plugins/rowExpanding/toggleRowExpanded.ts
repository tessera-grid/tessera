import type { Row } from '../../types'
import { announceLabel, announcerLabels } from '../../core/announcer'
import { DEFAULT_LABELS } from '../../core/localization'
import { isThenable, rejectionText } from '../../core/thenable'
import {
  markExpandFailed,
  readLoadedChildren,
  setLoadedAnswer,
} from './lazyChildrenFeature'
import { type BatchTable, enqueueAnswer } from './answerBatch'
import type { RowExpandingHooks } from './types'

type PendingRow = Row<any, any> & {
  getIsExpandPending?: () => boolean
  table: BatchTable & {
    options: {
      getSubRows?: (row: unknown, index: number) => unknown[] | undefined
    }
  }
}

/**
 * Ленивая строка (ADR 0054): `hasChildren` истинно, а детей в данных приложения нет
 * (сохранённый ответ `loadChildren` не в счёт).
 */
export const isLazyRow = (
  row: Row<any, any>,
  hasChildren: RowExpandingHooks['hasChildren'],
): boolean =>
  !!hasChildren &&
  !(row as PendingRow).table.options.getSubRows?.(row.original, row.index)
    ?.length &&
  hasChildren(row)

const storeAnswer = (table: unknown, rowId: string, rows: unknown) =>
  setLoadedAnswer(table, prev => ({
    ...prev,
    [rowId]: Array.isArray(rows) ? rows : [],
  }))

// Номер попытки сквозной: итог прежнего раскрытия не спутать с новым.
let lastAttempt = 0

/**
 * Переключить раскрытие и уведомить `onExpandRow` (общий путь клика и клавиши).
 * Ленивая строка зовёт `loadChildren` на каждое раскрытие (ADR 0054). Промис —
 * ожидание: повторное нажатие до итога игнорируется; отказ сворачивает строку, если
 * сохранённого ответа нет, вспыхивает и объявляется (ADR 0041, §3; ADR 0054, §4).
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
  // Явное значение: при сохранённом `expanded: true` переключатель TanStack сворачивал
  // бы строку, которую сужение показывает свёрнутой (ленивую без ответа).
  row.toggleExpanded(expanding)
  const notified = hooks.onExpandRow?.(row, expanding)
  if (!expanding) {
    return
  }
  const { table } = pendingRow
  const lazy = !!hooks.loadChildren && isLazyRow(row, hooks.hasChildren)
  const result = lazy ? hooks.loadChildren!(row) : notified
  if (lazy && !isThenable(result)) {
    storeAnswer(table, row.id, result)
    return
  }
  const setPending = table.setRowExpandPending
  if (!isThenable(result) || !setPending) {
    return
  }
  const attempt = ++lastAttempt
  setPending(prev => ({ ...prev, [row.id]: attempt }))
  const settle = (ok: boolean, value: unknown) => {
    if (table.atoms.rowExpandPending?.get()[row.id] !== attempt) {
      return
    }
    // Ответ ленивой строки снимает ожидание вместе с пачкой ответов до кадра (ADR 0066).
    if (ok && lazy) {
      enqueueAnswer(table, row.id, attempt, value)
      return
    }
    setPending(prev => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    if (ok) {
      return
    }
    if (!(lazy && row.id in readLoadedChildren(table))) {
      row.toggleExpanded(false)
    }
    markExpandFailed(table, row.id, attempt)
    const labels = announcerLabels(table) ?? DEFAULT_LABELS
    const error = rejectionText(value) ?? labels.loadChildrenFailed
    announceLabel(table, all => all.announceExpandFailed(error))
  }
  result.then(
    value => settle(true, value),
    reason => settle(false, reason),
  )
}
