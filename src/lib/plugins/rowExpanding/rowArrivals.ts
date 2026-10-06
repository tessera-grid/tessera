/**
 * Отметки прихода ленивых детей (ADR 0056): новые дети асинхронного ответа получают
 * момент прихода; строка с отметкой подсвечена. Один таймер на таблицу снимает
 * отметки, чьё время вышло (`--tsr-comp-row-arrival-duration` грида).
 */
import { readGridToken } from '../../core/announcer'
import { parseDuration } from '../../ui/buttonStates/useErrorFlash'
import { readRowArrivals, setRowArrivals } from './lazyChildrenFeature'

const DEFAULT_DURATION = 300

const timers = new WeakMap<object, ReturnType<typeof setTimeout>>()

const storeOf = (table: unknown) => (table as { store: object }).store

const holdOf = (table: unknown) =>
  parseDuration(readGridToken(table, '--tsr-comp-row-arrival-duration')) ||
  DEFAULT_DURATION

/** Снять истёкшие отметки и перезавести таймер на ближайшую оставшуюся. */
const sweep = (table: unknown) => {
  const store = storeOf(table)
  clearTimeout(timers.get(store))
  timers.delete(store)
  const hold = holdOf(table)
  const now = performance.now()
  const arrivals = readRowArrivals(table)
  const expired = Object.keys(arrivals).filter(
    id => now - arrivals[id]! >= hold,
  )
  if (expired.length > 0) {
    setRowArrivals(table, prev => {
      const next = { ...prev }
      expired.forEach(id => delete next[id])
      return next
    })
  }
  const left = Object.values(readRowArrivals(table))
  if (left.length > 0) {
    const due = Math.min(...left) + hold - now
    timers.set(
      store,
      setTimeout(() => sweep(table), Math.max(0, due)),
    )
  }
}

/** Отметить пришедшие строки моментом «сейчас». */
export const markArrivals = (table: unknown, rowIds: readonly string[]) => {
  if (rowIds.length === 0) {
    return
  }
  const now = performance.now()
  setRowArrivals(table, prev => {
    const next = { ...prev }
    rowIds.forEach(id => (next[id] = now))
    return next
  })
  sweep(table)
}

/** Удалить отметки строк (ушедших из данных). */
export const dropArrivals = (table: unknown, rowIds: readonly string[]) => {
  const arrivals = readRowArrivals(table)
  const gone = rowIds.filter(id => id in arrivals)
  if (gone.length === 0) {
    return
  }
  setRowArrivals(table, prev => {
    const next = { ...prev }
    gone.forEach(id => delete next[id])
    return next
  })
}
