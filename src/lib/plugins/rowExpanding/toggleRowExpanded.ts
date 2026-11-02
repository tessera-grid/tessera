import type { Row } from '../../types'
import { announceLabel, announcerLabels } from '../../core/announcer'
import { DEFAULT_LABELS } from '../../core/localization'
import {
  type CancelSource,
  lateAnswer,
  registerPending,
} from '../../core/cancellation'
import { reportAction, reportOutcome } from '../../core/debugActions'
import { rowSourceOf } from '../../core/rowSource'
import { flashOutcome } from '../../core/flashes/flashFeature'
import { setObjectPending } from '../../shared/objectPending'
import { inOneCommit } from '../../util/oneCommit'
import { isThenable, rejectionText } from '../../util/thenable'
import {
  clearExpandFailed,
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

const storeAnswer = (table: unknown, rowId: string, rows: unknown) => {
  setLoadedAnswer(table, prev => ({
    ...prev,
    [rowId]: Array.isArray(rows) ? rows : [],
  }))
}

/**
 * Отмена загрузки ветки серверной модели (ADR 0155, §3): запросы ветки прерваны, строка
 * свёрнута тихо.
 */
export const cancelBranchLoad = (row: Row<any, any>, source: CancelSource) => {
  const { table } = row as PendingRow
  rowSourceOf(table).cancelBranch?.(row.id)
  row.toggleExpanded(false)
  reportAction(table, {
    plugin: 'rowExpanding',
    action: 'cancel',
    detail: { action: 'loadChildren', rowId: row.id },
    source,
  })
  announceLabel(table, all => all.announceActionCancelled(all.expandRow))
}

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
  // Новое нажатие — повтор: отметка прошлого отказа снимается (IR13).
  clearExpandFailed(pendingRow.table, id => id !== row.id)
  const expanding = !row.getIsExpanded()
  // Явное значение: при сохранённом `expanded: true` переключатель TanStack сворачивал
  // бы строку, которую сужение показывает свёрнутой (ленивую без ответа).
  row.toggleExpanded(expanding)
  const notified = hooks.onExpandRow?.(row, expanding)
  if (!expanding) {
    // Свернули строку — «раскрыто всё» кончилось: ленивые строки больше не грузятся сами.
    ;(
      pendingRow.table as { setRowExpandAll?: (on: boolean) => void }
    ).setRowExpandAll?.(false)
    return
  }
  const { table } = pendingRow
  const lazy = !!hooks.loadChildren && isLazyRow(row, hooks.hasChildren)
  const controller = new AbortController()
  const result = lazy
    ? hooks.loadChildren!(row, { signal: controller.signal })
    : notified
  // Итог загрузки детей или промиса `onExpandRow` — с причиной: нажатием этой задачи.
  reportOutcome(
    table,
    { plugin: 'rowExpanding', action: lazy ? 'loadChildren' : 'expandRow' },
    result,
  )
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
  // Ожидание промиса раскрытия — волна строки; у ленивой — строка-заглушка детей (ADR 0155).
  const waveKey = `rowExpand:${row.id}`
  if (!lazy) setObjectPending(table, waveKey, [{ row: row.id }])
  const clearPending = () => {
    setObjectPending(table, waveKey, undefined)
    setPending(prev => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
  }
  // Отмена тихая (ADR 0153, §4): строка без ответа сворачивается без вспышки и отметки.
  const cancel = (source: CancelSource) => {
    if (controller.signal.aborted) return
    controller.abort()
    unregister()
    reportAction(table, {
      plugin: 'rowExpanding',
      action: 'cancel',
      detail: { action: 'loadChildren', rowId: row.id },
      source,
    })
    inOneCommit(() => {
      clearPending()
      if (!(row.id in readLoadedChildren(table))) row.toggleExpanded(false)
    })
    announceLabel(table, all => all.announceActionCancelled(all.expandRow))
  }
  const unregister = lazy
    ? registerPending(table, { kind: 'children', id: row.id, cancel })
    : () => {}
  const settle = (ok: boolean, value: unknown) => {
    if (controller.signal.aborted) {
      lateAnswer(table, ok ? undefined : value)
      return
    }
    unregister()
    if (table.atoms.rowExpandPending?.get()[row.id] !== attempt) {
      return
    }
    // Ответ ленивой строки снимает ожидание вместе с пачкой ответов до кадра (ADR 0066).
    if (ok && lazy) {
      enqueueAnswer(table, row.id, attempt, value)
      return
    }
    clearPending()
    if (ok) {
      return
    }
    if (!(lazy && row.id in readLoadedChildren(table))) {
      row.toggleExpanded(false)
      // Строка свёрнута обратно — в том же кадре, что отказ на переключателе.
      flashOutcome(table, { row: row.id }, 'reverted')
    }
    markExpandFailed(table, row.id, attempt, value)
    const labels = announcerLabels(table) ?? DEFAULT_LABELS
    const error = rejectionText(value) ?? labels.loadChildrenFailed
    announceLabel(table, all => all.announceExpandFailed(error))
  }
  // Снятие ожидания и сворачивание при отказе — одним коммитом.
  result.then(
    value => inOneCommit(() => settle(true, value)),
    reason => inOneCommit(() => settle(false, reason)),
  )
}
