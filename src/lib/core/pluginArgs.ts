/**
 * Живые аргументы фабрик плагинов (ADR 0039, RX1–RX3). Запись `definePlugin` несёт
 * аргументы фабрики, их ключ по значению и отложенную настройку `configure`; ядро
 * пересобирает настройку только при смене ключа, а функции из аргументов подаёт
 * стабильными обёртками, которые зовут последнюю версию.
 */
import type { TesseraFeatureEntry } from './features'
import { createRenderVersion, type RenderVersionAtom } from './renderVersion'

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

/**
 * Аргументы последнего коммита, аргументы монтирования и обёртки функций одной таблицы.
 * Аргументы первого рендера хранилище берёт при создании, дальше — в эффекте коммита.
 */
export interface PluginArgsStore {
  latest: Map<string, unknown>
  mounted: Map<string, unknown>
  trampolines: Map<string, (...args: unknown[]) => unknown>
  /** Растёт при новой ссылке на предикат из `refreshArgs` (перерисовка ячеек). */
  renderVersion: RenderVersionAtom
}

export const createPluginArgsStore = (
  entries: readonly TesseraFeatureEntry[],
): PluginArgsStore => {
  const args = new Map(
    entries.flatMap(entry =>
      entry.configure ? [[entry.id, entry.args] as const] : [],
    ),
  )
  return {
    latest: args,
    mounted: new Map(args),
    trampolines: new Map(),
    renderVersion: createRenderVersion(),
  }
}

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

/**
 * Эффект коммита: запомнить аргументы — обёртки функций читают их при вызове; новая
 * ссылка на предикат из `refreshArgs` поднимает версию отрисовки ячеек.
 */
export const rememberPluginArgs = (
  store: PluginArgsStore,
  entries: readonly TesseraFeatureEntry[],
): void => {
  let refresh = false
  for (const entry of entries) {
    if (entry.configure) {
      const previous = store.latest.get(entry.id)
      if (
        entry.refreshArgs?.some(
          key =>
            readPath(previous, [key]) !== readPath(entry.args, [key]) &&
            (typeof readPath(previous, [key]) === 'function' ||
              typeof readPath(entry.args, [key]) === 'function'),
        )
      ) {
        refresh = true
      }
      store.latest.set(entry.id, entry.args)
      if (!store.mounted.has(entry.id)) {
        store.mounted.set(entry.id, entry.args)
      }
    }
  }
  if (refresh) store.renderVersion.set(version => version + 1)
}

/** Аргументы с договорами на время жизни, взятыми с момента монтирования (RX4). */
const withLifetimeArgs = (
  store: PluginArgsStore,
  entry: TesseraFeatureEntry,
): unknown => {
  const mounted = store.mounted.get(entry.id)
  if (!entry.lifetimeArgs?.length || !isPlainObject(mounted)) {
    return entry.args
  }
  const args = { ...(entry.args as Record<string, unknown>) }
  for (const key of entry.lifetimeArgs) {
    args[key] = mounted[key]
  }
  return args
}

/** Аргументы-договоры, чьё значение сменилось после монтирования: `id.аргумент`. */
export const lifetimeArgViolations = (
  store: PluginArgsStore,
  entries: readonly TesseraFeatureEntry[],
): string[] =>
  entries.flatMap(entry => {
    const mounted = store.mounted.get(entry.id)
    if (!entry.lifetimeArgs?.length || !isPlainObject(mounted)) {
      return []
    }
    const latest = entry.args as Record<string, unknown>
    return (
      entry.lifetimeArgs
        .filter(key => argsKeyOf(latest?.[key]) !== argsKeyOf(mounted[key]))
        // Аргумент включённой модели приложение передало интерфейсу (ADR 0120).
        .map(key => `${entry.includedBy ?? entry.id}.${key}`)
    )
  })

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
      ? {
          ...entry,
          ...entry.configure(
            viewOf(store, entry.id, withLifetimeArgs(store, entry)),
          ),
        }
      : entry,
  )
