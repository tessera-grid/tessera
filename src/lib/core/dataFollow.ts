/**
 * Новый `data` в клиентском режиме (ADR 0194, IU12): то, что стоит на строках, держит свою
 * строку — активная ячейка, выделение. Слушатели получают список строк до смены и после неё;
 * смену замечает эффект таблицы после рендера с новым `data`.
 */
import { rowSourceOf } from './rowSource'

export interface ListedRow {
  id: string
}

export type DataChangeListener = (
  previous: readonly ListedRow[],
  next: readonly ListedRow[],
) => void

const listeners = new WeakMap<object, Set<DataChangeListener>>()

export const followDataChanges = (
  table: unknown,
  listener: DataChangeListener,
): (() => void) => {
  const key = table as object
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)
  return () => set.delete(listener)
}

/** Список строк при прошлой проверке; серверная модель следует за списком сама (ADR 0157). */
export interface SeenData {
  data: unknown
  list: readonly ListedRow[]
}

/** Проверка после рендера: `data` и список строк сменились — слушатели узнают об этом. */
export const checkDataChange = (
  table: unknown,
  seen: SeenData | undefined,
): SeenData | undefined => {
  const set = listeners.get(table as object)
  if (!set?.size) return undefined
  const source = rowSourceOf<ListedRow>(table)
  if (source.keyByIndex) return undefined
  const list = source.rows?.()
  if (!list) return undefined
  const data = (table as { options: { data: unknown } }).options.data
  if (seen && seen.data !== data && seen.list !== list) {
    for (const listener of [...set]) listener(seen.list, list)
  }
  return { data, list }
}
