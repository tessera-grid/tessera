/**
 * Иерархия строк (ADR 0168, §4): модель дерева объявляет `'tree'`, модель группировки —
 * `'groups'`; читают её плагины и грид, которым важно, что строки — не плоский список.
 */
export type RowHierarchy = 'tree' | 'groups'

// Ключ — общий store: React-адаптер отдаёт гриду другой объект таблицы, чем ячейкам.
const hierarchies = new WeakMap<object, Set<RowHierarchy>>()
const NO_STORE = {}

/** Объявить иерархию в `setup` плагина; результат — его cleanup. */
export const declareRowHierarchy = (table: unknown, kind: RowHierarchy) => {
  const { store } = table as { store: object }
  const kinds = hierarchies.get(store) ?? new Set()
  hierarchies.set(store, kinds)
  kinds.add(kind)
  return () => {
    kinds.delete(kind)
  }
}

export const hasRowHierarchy = (table: unknown, kind: RowHierarchy) =>
  hierarchies.get((table as { store?: object }).store ?? NO_STORE)?.has(kind) ??
  false
