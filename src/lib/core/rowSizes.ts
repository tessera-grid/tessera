/**
 * Высоты строк по содержимому (ADR 0218, §4–5): плагин пишет высоту содержимого строки по её
 * id, виртуализатор строк берёт размер строки отсюда — не меньше `rowHeight`. Незамеренная
 * строка — высотой оценки `estimatedRowHeight`.
 */

/** Ключ таблицы: `useTable` отдаёт новую копию экземпляра, хранилище — одно. */
const storeOf = (table: unknown) => (table as { store: object }).store

type Listener = (changed: readonly string[] | undefined) => void

interface Entry {
  /** Высота содержимого строки по id, px. */
  needs: Map<string, number>
  listeners: Set<Listener>
}

const entries = new WeakMap<object, Entry>()

const entryOf = (table: unknown): Entry => {
  const store = storeOf(table)
  let entry = entries.get(store)
  if (!entry) {
    entry = { needs: new Map(), listeners: new Set() }
    entries.set(store, entry)
  }
  return entry
}

/** Высоты содержимого строк таблицы по id. */
export const rowNeedsOf = (table: unknown): ReadonlyMap<string, number> =>
  entryOf(table).needs

/** Оценка высоты незамеренной строки (ADR 0218, §6); нет — строки одной высоты. */
export const estimatedRowHeightOf = (table: unknown) =>
  (table as { options: { estimatedRowHeight?: number } }).options
    .estimatedRowHeight

/** Строки разной высоты: есть замеры или оценка. */
export const hasRowSizes = (table: unknown) =>
  entryOf(table).needs.size > 0 || estimatedRowHeightOf(table) !== undefined

/** Размер строки: высота содержимого, но не меньше строки; незамеренная — оценка. */
export const rowSizeOf = (
  needs: ReadonlyMap<string, number>,
  id: string | undefined,
  rowHeight: number,
  estimate: number | undefined,
) => {
  const need = id === undefined ? undefined : needs.get(id)
  if (need !== undefined) return Math.max(rowHeight, need)
  return estimate ?? rowHeight
}

/** Высоты содержимого строк пачкой; `undefined` — забыть строку. */
export const setRowNeeds = (
  table: unknown,
  changes: Iterable<readonly [string, number | undefined]>,
) => {
  const entry = entryOf(table)
  const changed: string[] = []
  for (const [id, need] of changes) {
    if (entry.needs.get(id) === need) continue
    if (need === undefined) entry.needs.delete(id)
    else entry.needs.set(id, need)
    changed.push(id)
  }
  if (changed.length === 0) return
  for (const listener of entry.listeners) listener(changed)
}

/** Забыть все высоты: плагин снят. */
export const clearRowNeeds = (table: unknown) => {
  const entry = entryOf(table)
  if (entry.needs.size === 0) return
  entry.needs.clear()
  for (const listener of entry.listeners) listener(undefined)
}

/** Подписка на смену высот: `changed` — id строк, `undefined` — всё. */
export const subscribeRowSizes = (table: unknown, listener: Listener) => {
  const entry = entryOf(table)
  entry.listeners.add(listener)
  return () => {
    entry.listeners.delete(listener)
  }
}
