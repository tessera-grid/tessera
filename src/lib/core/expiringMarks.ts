/**
 * Отметки с временем жизни (ADR 0056, ADR 0057): момент по `performance.now()` под
 * ключом; один таймер на таблицу снимает отметки, чьё время вышло — длительность из
 * токена темы грида. Общий код подсветки пришедших строк и сохранённых ячеек.
 */
import { readGridToken } from './announcer'
import { parseDuration } from '../ui/buttonStates/useErrorFlash'

export type Marks = Record<string, number>
type MarksUpdater = (prev: Marks) => Marks

interface ExpiringMarksSpec {
  read: (table: unknown) => Marks
  write: (table: unknown, updater: MarksUpdater) => void
  /** Токен удержания отметки, например `--tsr-comp-row-arrival-duration`. */
  token: string
  /** Длительность без смонтированного грида, мс. */
  fallback: number
}

const without = (marks: Marks, ids: readonly string[]) => {
  const next = { ...marks }
  ids.forEach(id => delete next[id])
  return next
}

export const createExpiringMarks = ({
  read,
  write,
  token,
  fallback,
}: ExpiringMarksSpec) => {
  const timers = new WeakMap<object, ReturnType<typeof setTimeout>>()
  const storeOf = (table: unknown) => (table as { store: object }).store

  /** Снять истёкшие отметки и перезавести таймер на ближайшую оставшуюся. */
  const sweep = (table: unknown) => {
    const store = storeOf(table)
    clearTimeout(timers.get(store))
    timers.delete(store)
    const hold = parseDuration(readGridToken(table, token)) || fallback
    const now = performance.now()
    const marks = read(table)
    const expired = Object.keys(marks).filter(id => now - marks[id]! >= hold)
    if (expired.length > 0) {
      write(table, prev => without(prev, expired))
    }
    const left = Object.values(read(table))
    if (left.length > 0) {
      const due = Math.min(...left) + hold - now
      timers.set(
        store,
        setTimeout(() => sweep(table), Math.max(0, due)),
      )
    }
  }

  return {
    /** Отметить ключи моментом «сейчас». */
    mark: (table: unknown, ids: readonly string[]) => {
      if (ids.length === 0) {
        return
      }
      const now = performance.now()
      write(table, prev => {
        const next = { ...prev }
        ids.forEach(id => (next[id] = now))
        return next
      })
      sweep(table)
    },
    /** Снять отметки ключей. */
    drop: (table: unknown, ids: readonly string[]) => {
      const marks = read(table)
      const gone = ids.filter(id => id in marks)
      if (gone.length > 0) {
        write(table, prev => without(prev, gone))
      }
    },
  }
}
