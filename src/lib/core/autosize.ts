/**
 * Автоподбор ширины (ADR 0217, §1): колонки вне окна виртуализации на время замера входят в окно
 * колонок — `useMeasuringColumns` читает экстрактор окна, замер ставит набор плагин `columnSizing`.
 */
import { useSyncExternalStore } from 'react'

/** Ключ таблицы: `useTable` отдаёт новую копию экземпляра, хранилище — одно. */
const storeOf = (table: unknown) => (table as { store: object }).store

interface Measuring {
  ids: ReadonlySet<string>
  listeners: Set<() => void>
}

const EMPTY: ReadonlySet<string> = new Set()
const measuring = new WeakMap<object, Measuring>()

const measuringOf = (table: unknown) => {
  const store = storeOf(table)
  let entry = measuring.get(store)
  if (!entry) {
    entry = { ids: EMPTY, listeners: new Set() }
    measuring.set(store, entry)
  }
  return entry
}

/** Колонки, которые сейчас меряются: окно колонок держит их отрисованными. */
export const setMeasuringColumns = (
  table: unknown,
  columnIds: readonly string[],
) => {
  const entry = measuringOf(table)
  entry.ids = columnIds.length ? new Set(columnIds) : EMPTY
  for (const listener of entry.listeners) listener()
}

/** Набор измеряемых колонок; меняется — перерисовка подписчика. */
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
