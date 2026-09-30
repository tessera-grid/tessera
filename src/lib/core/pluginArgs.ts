/**
 * Живые аргументы фабрик плагинов (ADR 0039, RX1–RX3). Запись `definePlugin` несёт
 * аргументы фабрики, их ключ по значению и отложенную настройку `configure`; ядро
 * пересобирает настройку только при смене ключа, а функции из аргументов подаёт
 * стабильными обёртками, которые зовут последнюю версию.
 */
import type { TesseraFeatureEntry } from './features'

const FUNCTION_KEY = '"ƒ"'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype

/**
 * Ключ аргументов по значению: новый объект с теми же значениями даёт тот же ключ
 * (RX3). Функции в ключ входят только фактом наличия — их смена живёт в обёртке.
 */
export const argsKeyOf = (value: unknown): string => {
  if (typeof value === 'function') {
    return FUNCTION_KEY
  }
  if (Array.isArray(value)) {
    return `[${value.map(argsKeyOf).join(',')}]`
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
    return `{${keys.map(key => `${JSON.stringify(key)}:${argsKeyOf(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

const readPath = (value: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>(
    (current, key) =>
      isPlainObject(current)
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value,
  )

/** Последние аргументы и обёртки функций одной таблицы. */
export interface PluginArgsStore {
  latest: Map<string, unknown>
  trampolines: Map<string, (...args: unknown[]) => unknown>
}

export const createPluginArgsStore = (): PluginArgsStore => ({
  latest: new Map(),
  trampolines: new Map(),
})

/**
 * Вид аргументов для `configure`: значения как есть, функции — стабильные обёртки
 * по пути (`id` + ключи), читающие функцию из последних аргументов в момент вызова.
 */
const viewOf = (
  store: PluginArgsStore,
  id: string,
  value: unknown,
  path: string[] = [],
): unknown => {
  if (typeof value === 'function') {
    const key = [id, ...path].join('.')
    let trampoline = store.trampolines.get(key)
    if (!trampoline) {
      trampoline = (...args: unknown[]) => {
        const latest = readPath(store.latest.get(id), path)
        return typeof latest === 'function' ? latest(...args) : undefined
      }
      store.trampolines.set(key, trampoline)
    }
    return trampoline
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        viewOf(store, id, item, [...path, key]),
      ]),
    )
  }
  return value
}

/** Запомнить аргументы текущего рендера: обёртки функций читают их при вызове. */
export const rememberPluginArgs = (
  store: PluginArgsStore,
  entries: readonly TesseraFeatureEntry[],
) => {
  for (const entry of entries) {
    if (entry.configure) {
      store.latest.set(entry.id, entry.args)
    }
  }
}

/** Сигнатура значений аргументов набора: меняется только при смене значения. */
export const pluginArgsSignature = (
  entries: readonly TesseraFeatureEntry[],
): string =>
  entries.map(entry => `${entry.id}=${entry.argsKey ?? ''}`).join('|')

/**
 * Записи с настройкой, пересобранной из вида аргументов: функции в опциях, слотах
 * и `setup` — стабильные обёртки, поэтому пересборка не дёргает мемо row-моделей.
 */
export const resolvePluginEntries = (
  store: PluginArgsStore,
  entries: readonly TesseraFeatureEntry[],
): TesseraFeatureEntry[] =>
  entries.map(entry =>
    entry.configure
      ? { ...entry, ...entry.configure(viewOf(store, entry.id, entry.args)) }
      : entry,
  )
