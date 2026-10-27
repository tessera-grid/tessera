/**
 * Плагины модели и интерфейса (ADR 0120, §3). Плагин интерфейса несёт запись своей
 * модели (`entry.model`); ядро раскрывает её в отдельную запись перед своим интерфейсом.
 * Явная модель в наборе главнее включённой, одна модель в наборе — одна запись.
 */
import type { TesseraFeatureEntry } from './features'
import type { NarrowMap, NarrowState } from './effectiveState'
import { argsKeyOf } from './pluginArgs'

/**
 * Аргументы модели у интерфейса не действуют: расходятся с явной моделью (MP5) или с
 * аргументами интерфейса `over`, который включил модель раньше (MP18).
 */
export interface ModelArgsMismatch {
  modelId: string
  includedBy: string
  over?: string
}

export const modelArgsMismatchMessage = ({
  modelId,
  includedBy,
  over,
}: ModelArgsMismatch): string =>
  over === undefined
    ? `аргументы модели у ${includedBy} не действуют: в наборе есть явная ${modelId} — её аргументы главнее; задайте их у ${modelId}`
    : `аргументы модели у ${includedBy} не действуют: ${modelId} уже включил ${over} со своими аргументами; задайте их у одного интерфейса или явной ${modelId}`

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
 * действует включённая из включённого, с аргументами модели того, кто их задал.
 * Включённая явная модель вытесняет включённые;
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
  const takeover = new Map<
    string,
    { entry: TesseraFeatureEntry; includedBy: string }
  >()

  // Модель уже включил `currentBy`: заменяет ли её запись интерфейса `includedBy` —
  // включённая выключенную, с аргументами модели — без них (MP18).
  const replaces = (
    current: TesseraFeatureEntry,
    currentBy: string,
    model: TesseraFeatureEntry,
    includedBy: string,
  ): boolean => {
    if (model.enabled === false) return false
    if (current.enabled === false) return true
    const args = modelArgsKey(model)
    if (args === undefined) return false
    const currentArgs = modelArgsKey(current)
    if (currentArgs === undefined) return true
    if (args !== currentArgs) {
      mismatches.push({ modelId: model.id, includedBy, over: currentBy })
    }
    return false
  }

  const include = (model: TesseraFeatureEntry, includedBy: string) => {
    const own = explicit.get(model.id)
    if (own) {
      if (own.enabled !== false) {
        const args = modelArgsKey(model)
        if (args !== undefined && args !== modelArgsKey(own)) {
          mismatches.push({ modelId: model.id, includedBy })
        }
        return
      }
      const current = takeover.get(model.id)
      if (
        model.enabled !== false &&
        (!current ||
          replaces(current.entry, current.includedBy, model, includedBy))
      ) {
        takeover.set(model.id, { entry: model, includedBy })
        if (model.model) {
          include(model.model, model.id)
        }
      }
      return
    }
    const at = included.get(model.id)
    if (at !== undefined) {
      const current = entries[at]!
      if (replaces(current, current.includedBy!, model, includedBy)) {
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
            ? takeover.get(entry.id)!.entry
            : entry,
        )
      : entries,
    mismatches,
  }
}

/** Срезы из аргументов плагинов: значения, колбэки и начальные значения по ключу среза. */
export interface PluginSlices {
  keys: string[]
  /** Срезы с внешним значением: их хранит ядро (контроль). */
  controlled: string[]
  state: Record<string, unknown>
  listeners: Record<string, (next: unknown) => void>
  initial: Record<string, unknown>
}

export const pluginSlicesOf = (
  entries: readonly TesseraFeatureEntry[],
): PluginSlices => {
  const slices: PluginSlices = {
    keys: [],
    controlled: [],
    state: {},
    listeners: {},
    initial: {},
  }
  for (const entry of entries) {
    for (const { key, value, onChange, initial } of entry.stateSlices ?? []) {
      slices.keys.push(key)
      if (value !== undefined) {
        slices.state[key] = value
        slices.controlled.push(key)
      }
      if (onChange) slices.listeners[key] = onChange
      if (initial !== undefined) slices.initial[key] = initial
    }
  }
  return slices
}

const KEEP: NarrowState[] = [value => value]

/**
 * Срез плагина с внешним значением, но без своего сужения ядро ведёт, как суженный:
 * сужение «как есть». Без внешнего значения срезом владеет TanStack.
 */
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
