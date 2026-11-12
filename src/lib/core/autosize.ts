/**
 * Колонки вне окна виртуализации, которые окно колонок держит отрисованными: на время замера
 * автоподбора ширины (ADR 0217, §1) и всегда — колонки высоты строк по содержимому (ADR 0218,
 * §4). `useMeasuringColumns` читает экстрактор окна, наборы ставят плагины — каждый свой.
 */
import { useSyncExternalStore } from 'react'

/** Ключ таблицы: `useTable` отдаёт новую копию экземпляра, хранилище — одно. */
const storeOf = (table: unknown) => (table as { store: object }).store

interface Measuring {
  /** Наборы по владельцам: `autosize`, `textWrap`. */
  owners: Map<string, ReadonlySet<string>>
  ids: ReadonlySet<string>
  listeners: Set<() => void>
}

const EMPTY: ReadonlySet<string> = new Set()
const measuring = new WeakMap<object, Measuring>()

const measuringOf = (table: unknown) => {
  const store = storeOf(table)
  let entry = measuring.get(store)
  if (!entry) {
    entry = { owners: new Map(), ids: EMPTY, listeners: new Set() }
    measuring.set(store, entry)
  }
  return entry
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every(id => b.has(id))

/** Колонки владельца, которые окно колонок держит отрисованными; пустой список — снять. */
export const setMeasuringColumns = (
  table: unknown,
  columnIds: readonly string[],
  owner = 'autosize',
) => {
  const entry = measuringOf(table)
  const next: ReadonlySet<string> = columnIds.length
    ? new Set(columnIds)
    : EMPTY
  if (sameSet(entry.owners.get(owner) ?? EMPTY, next)) return
  if (next.size) entry.owners.set(owner, next)
  else entry.owners.delete(owner)
  const union = new Set<string>()
  for (const ids of entry.owners.values()) for (const id of ids) union.add(id)
  entry.ids = union.size ? union : EMPTY
  for (const listener of entry.listeners) listener()
}

/** Колонки, которые окно держит отрисованными; меняется — перерисовка подписчика. */
export const useMeasuringColumns = (table: unknown) => {
  const entry = measuringOf(table)
  return useSyncExternalStore(
    listener => {
      entry.listeners.add(listener)
      return () => entry.listeners.delete(listener)
    },
    () => entry.ids,
    () => EMPTY,
  )
}
