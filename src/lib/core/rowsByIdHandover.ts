/**
 * Словарь `rowsById` новой модели поверх словаря прежней (ADR 0200, §4; ADR 0069): новая модель
 * пишет в свой слой — новые строки и метки удалённых, — а опубликованный словарь и прежняя модель
 * не меняются. Через `MAX_DEPTH` слоёв словарь собирается заново: в среднем O(n / MAX_DEPTH) на
 * смену вместо копии словаря.
 */
import { makeObjectMap } from '@tanstack/react-table'

interface IndexedRow {
  id: string
}

export const indexRows = <TRow extends IndexedRow>(
  flatRows: readonly TRow[],
) => {
  const rowsById = makeObjectMap<TRow>()
  for (const row of flatRows) {
    rowsById[row.id] = row
  }
  return rowsById
}

const MAX_DEPTH = 8
const REMOVED = Symbol('removed')

interface Layer {
  base: Record<string, unknown>
  own: Map<string, unknown>
  depth: number
  /** Ключи слоя — собираются при первом обходе. */
  keys?: string[]
}

const layers = new WeakMap<object, Layer>()

const depthOf = (rowsById: object) => layers.get(rowsById)?.depth ?? 0

/** Плоская копия словаря: обход слоёв один раз. */
const flatten = (rowsById: Record<string, unknown>) => {
  const flat = makeObjectMap<unknown>()
  for (const key of Object.keys(rowsById)) flat[key] = rowsById[key]
  return flat
}

const keysOf = (layer: Layer) => {
  const keys: string[] = []
  for (const key of Object.keys(layer.base)) {
    if (!layer.own.has(key)) keys.push(key)
  }
  for (const [key, value] of layer.own) {
    if (value !== REMOVED) keys.push(key)
  }
  return keys
}

/**
 * Словарь новой модели поверх словаря `model`: записи и удаления — в свой слой. Модель и её
 * словарь не меняются.
 */
export const handOverRowsById = <TRow extends IndexedRow>(model: {
  rowsById: Record<string, TRow>
}): Record<string, TRow> => {
  const base =
    depthOf(model.rowsById) >= MAX_DEPTH
      ? flatten(model.rowsById)
      : (model.rowsById as Record<string, unknown>)
  const layer: Layer = { base, own: new Map(), depth: depthOf(base) + 1 }
  const read = (key: string) => {
    if (!layer.own.has(key)) return layer.base[key]
    const value = layer.own.get(key)
    return value === REMOVED ? undefined : value
  }
  const proxy = new Proxy(makeObjectMap<TRow>(), {
    get: (_, key) => (typeof key === 'string' ? read(key) : undefined),
    has: (_, key) => typeof key === 'string' && read(key) !== undefined,
    set: (_, key, value) => {
      layer.own.set(key as string, value)
      layer.keys = undefined
      return true
    },
    deleteProperty: (_, key) => {
      layer.own.set(key as string, REMOVED)
      layer.keys = undefined
      return true
    },
    ownKeys: () => (layer.keys ??= keysOf(layer)),
    getOwnPropertyDescriptor: (_, key) => {
      const value = typeof key === 'string' ? read(key) : undefined
      return value === undefined
        ? undefined
        : { value, writable: true, enumerable: true, configurable: true }
    },
  })
  layers.set(proxy, layer)
  return proxy
}
