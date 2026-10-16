/**
 * Плагины модели и интерфейса (ADR 0120, §3). Плагин интерфейса несёт запись своей
 * модели (`entry.model`); ядро раскрывает её в отдельную запись перед своим интерфейсом.
 * Явная модель в наборе главнее включённой, одна модель в наборе — одна запись.
 */
import type { TesseraFeatureEntry } from './features'
import type { NarrowMap, NarrowState } from './effectiveState'
import { argsKeyOf } from './pluginArgs'

/** Аргументы модели у интерфейса расходятся с явной моделью (MP5). */
export interface ModelArgsMismatch {
  modelId: string
  includedBy: string
}

const modelArgsKey = (entry: TesseraFeatureEntry): string | undefined => {
  const { enabled: _enabled, ...args } = (entry.args ?? {}) as Record<
    string,
    unknown
  >
  return Object.values(args).some(value => value !== undefined)
    ? argsKeyOf(args)
    : undefined
}

/**
 * Набор с раскрытыми моделями: включённая модель встаёт перед первым интерфейсом,
 * который её несёт, с пометкой `includedBy`. Её несут несколько интерфейсов —
 * действует включённая из включённого. Включённая явная модель вытесняет включённые;
 * выключенная явная рядом с включённым интерфейсом уступает модели интерфейса: модель
 * включена, если включена хоть одна несущая её запись.
 */
export const expandIncludedModels = (
  plugins: readonly TesseraFeatureEntry[],
): { entries: TesseraFeatureEntry[]; mismatches: ModelArgsMismatch[] } => {
  if (!plugins.some(entry => entry.model)) {
    return { entries: plugins as TesseraFeatureEntry[], mismatches: [] }
  }
  const explicit = new Map(plugins.map(entry => [entry.id, entry]))
  const entries: TesseraFeatureEntry[] = []
  const included = new Map<string, number>()
  const mismatches: ModelArgsMismatch[] = []
  // Выключенная явная модель → модель включённого интерфейса на её месте.
  const takeover = new Map<string, TesseraFeatureEntry>()

  const include = (model: TesseraFeatureEntry, includedBy: string) => {
    const own = explicit.get(model.id)
    if (own) {
      if (own.enabled !== false) {
        const args = modelArgsKey(model)
        if (args !== undefined && args !== modelArgsKey(own)) {
          mismatches.push({ modelId: model.id, includedBy })
        }
      } else if (model.enabled !== false && !takeover.has(model.id)) {
        takeover.set(model.id, model)
        if (model.model) {
          include(model.model, model.id)
        }
      }
      return
    }
    const at = included.get(model.id)
    if (at !== undefined) {
      if (entries[at]!.enabled === false && model.enabled !== false) {
        entries[at] = { ...model, includedBy }
      }
      return
    }
    if (model.model) {
      include(model.model, model.id)
    }
    included.set(model.id, entries.length)
    entries.push({ ...model, includedBy })
  }

  for (const entry of plugins) {
    if (entry.model) {
      include(entry.model, entry.id)
    }
    entries.push(entry)
  }
  return {
    entries: takeover.size
      ? entries.map(entry =>
          !entry.includedBy && takeover.has(entry.id)
            ? takeover.get(entry.id)!
            : entry,
        )
      : entries,
    mismatches,
  }
}

/** Срезы из аргументов плагинов: значения, колбэки и начальные значения по ключу среза. */
export interface PluginSlices {
  keys: string[]
  state: Record<string, unknown>
  listeners: Record<string, (next: unknown) => void>
  initial: Record<string, unknown>
}

export const pluginSlicesOf = (
  entries: readonly TesseraFeatureEntry[],
): PluginSlices => {
  const slices: PluginSlices = {
    keys: [],
    state: {},
    listeners: {},
    initial: {},
  }
  for (const entry of entries) {
    for (const { key, value, onChange, initial } of entry.stateSlices ?? []) {
      slices.keys.push(key)
      if (value !== undefined) slices.state[key] = value
      if (onChange) slices.listeners[key] = onChange
      if (initial !== undefined) slices.initial[key] = initial
    }
  }
  return slices
}

const KEEP: NarrowState[] = [value => value]

/** Срез плагина без своего сужения хранит ядро, как суженный: сужение «как есть». */
export const withSliceNarrows = (
  narrow: NarrowMap,
  keys: readonly string[],
): NarrowMap =>
  keys.every(key => key in narrow)
    ? narrow
    : {
        ...Object.fromEntries(keys.map(key => [key, KEEP])),
        ...narrow,
      }
