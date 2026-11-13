/**
 * Свои записи (ADR 0221, §1): плагин правки отмечает ячейки, которые человек записал в этой
 * таблице, — правка, пакет `onCommitEdits`, строки до сохранения. Отметка гасит ближайшую смену
 * значения ячейки, пока ждёт ответ колбэка и `OWN_WRITE_GRACE` после него: так эхо своей записи
 * не вспыхивает как смена извне, а поздняя смена извне — вспыхивает.
 */
import { isThenable } from '../util/thenable'

/** Сколько отметка живёт после ответа колбэка, мс: приложение успевает положить новый `data`. */
export const OWN_WRITE_GRACE = 2000

/** Ячейка записи; без `columnId` — вся строка (новая строка до сохранения). */
export interface OwnWrite {
  rowId: string
  columnId?: string
}

interface Mark {
  /** Сколько записей этой ячейки ещё ждут ответа. */
  pending: number
  /** Конец жизни после последнего ответа, по `performance.now()`. */
  until: number
}

const marks = new WeakMap<object, Map<string, Mark>>()

/** Ключ таблицы — хранилище: React-адаптер отдаёт на рендер новый объект таблицы. */
const tableKey = (table: unknown) =>
  ((table as { store?: object }).store ?? table) as object

const keyOf = (rowId: string, columnId?: string) =>
  columnId === undefined ? `r:${rowId}` : `c:${rowId}\u0000${columnId}`

/** Отметить записи до вызова колбэка; вернуть «ответ пришёл» — вызвать один раз. */
export const markOwnWrites = (
  table: unknown,
  writes: readonly OwnWrite[],
): (() => void) => {
  if (writes.length === 0) return () => {}
  const key = tableKey(table)
  let map = marks.get(key)
  if (!map) {
    map = new Map()
    marks.set(key, map)
  }
  // Отметки, чьё эхо так и не пришло, уходят при следующей записи.
  const now = performance.now()
  for (const [k, mark] of map) if (!live(mark, now)) map.delete(k)
  const keys = writes.map(write => keyOf(write.rowId, write.columnId))
  for (const k of keys) {
    const mark = map.get(k)
    if (mark) mark.pending++
    else map.set(k, { pending: 1, until: Infinity })
  }
  let settled = false
  return () => {
    if (settled) return
    settled = true
    const until = performance.now() + OWN_WRITE_GRACE
    for (const k of keys) {
      const mark = map.get(k)
      if (!mark) continue
      mark.pending = Math.max(0, mark.pending - 1)
      if (mark.pending === 0) mark.until = until
    }
  }
}

const live = (mark: Mark | undefined, now: number) =>
  !!mark && (mark.pending > 0 || mark.until >= now)

/**
 * Смена значения ячейки — своя запись? Живая отметка ячейки снимается: гасит одну смену.
 * Отметка строки гасит смены всех её ячеек, пока жива.
 */
export const consumeOwnWrite = (
  table: unknown,
  rowId: string,
  columnId: string,
): boolean => {
  const map = marks.get(tableKey(table))
  if (!map || map.size === 0) return false
  const now = performance.now()
  const cell = keyOf(rowId, columnId)
  const mark = map.get(cell)
  if (mark) {
    if (mark.pending === 0) map.delete(cell)
    if (live(mark, now)) return true
  }
  const row = map.get(keyOf(rowId))
  if (row && !live(row, now)) map.delete(keyOf(rowId))
  return live(row, now)
}

/** «Ответ пришёл» — по ответу колбэка: промис — когда решится, иначе сразу. */
export const settleOwnOn = (result: unknown, settle: () => void) => {
  if (isThenable(result)) result.then(settle, settle)
  else settle()
}
