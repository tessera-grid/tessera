/**
 * Высота шапки по содержимому (ADR 0218, §10): плагин пишет высоту каждого уровня шапки и
 * набор колонок, чьи заголовки рисуются и вне окна колонок; грид читает оба.
 */
import { useSyncExternalStore } from 'react'

/** Ключ таблицы: `useTable` отдаёт новую копию экземпляра, хранилище — одно. */
const storeOf = (table: unknown) => (table as { store: object }).store

interface Entry {
  /** Высота уровня шапки, px; нет — высота строки шапки. */
  levels: readonly number[] | undefined
  /** Колонки, чьи заголовки рисуются и вне окна колонок. */
  columns: ReadonlySet<string>
  listeners: Set<() => void>
}

const EMPTY: ReadonlySet<string> = new Set()
const NO_SUBSCRIBE = () => () => {}
const entries = new WeakMap<object, Entry>()

const entryOf = (table: unknown): Entry => {
  const store = storeOf(table)
  let entry = entries.get(store)
  if (!entry) {
    entry = { levels: undefined, columns: EMPTY, listeners: new Set() }
    entries.set(store, entry)
  }
  return entry
}

const notify = (entry: Entry) => {
  for (const listener of entry.listeners) listener()
}

const sameLevels = (
  a: readonly number[] | undefined,
  b: readonly number[] | undefined,
) =>
  a === b ||
  (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]))

/** Высоты уровней шапки; `undefined` — у всех уровней высота строки шапки. */
export const setHeadLevelHeights = (
  table: unknown,
  levels: readonly number[] | undefined,
) => {
  const entry = entryOf(table)
  if (sameLevels(entry.levels, levels)) return
  entry.levels = levels
  notify(entry)
}

/** Колонки, чьи заголовки рисуются и вне окна колонок; пустой список — снять. */
export const setHeadColumns = (
  table: unknown,
  columnIds: readonly string[],
) => {
  const entry = entryOf(table)
  const next: ReadonlySet<string> = columnIds.length
    ? new Set(columnIds)
    : EMPTY
  if (
    next.size === entry.columns.size &&
    [...next].every(id => entry.columns.has(id))
  )
    return
  entry.columns = next
  notify(entry)
}

const subscribe = (table: unknown) => (listener: () => void) => {
  const entry = entryOf(table)
  entry.listeners.add(listener)
  return () => {
    entry.listeners.delete(listener)
  }
}

export const useHeadLevelHeights = (table: unknown) =>
  useSyncExternalStore(
    subscribe(table),
    () => entryOf(table).levels,
    () => undefined,
  )

export const useHeadColumns = (table: unknown) =>
  useSyncExternalStore(
    table ? subscribe(table) : NO_SUBSCRIBE,
    () => (table ? entryOf(table).columns : EMPTY),
    () => EMPTY,
  )

/** Высота уровня `level` шапки — переменная темы с запасной высотой строки шапки. */
export const headLevelVar = (level: number) =>
  `var(--tsr-comp-head-level-${level}-height, var(--tsr-comp-head-row-height))`
