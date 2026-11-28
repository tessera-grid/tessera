/**
 * Подписи владельцев (ADR 0182, §8): плагин или общий модуль объявляет свои ключи с
 * английскими значениями, в словаре таблицы ключ — `<владелец>.<ключ>`. Ядро знает только
 * механизм: набор разрешает свои подписи из того же словаря и языка, что и подписи ядра.
 */
import {
  type LabelSource,
  PLURAL_FORMS,
  isCoreLabelKey,
  labelSourceOf,
  resolveOwnLabels,
} from './resolveLabels'

/**
 * Owners' label sets by their id — for the type of the application's dictionary. An owner
 * augments the interface (`declare module`): `interface PluginLabels { archiveRows: typeof archiveRowsLabels }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PluginLabels {}

type Owner = keyof PluginLabels & string

type PluralForm = (typeof PLURAL_FORMS)[number]

/** Labels of a set. */
export type LabelsOf<S> = S extends LabelSet<string, infer T> ? T : never

/** Подписи набора с параметром `count`: только у них бывают ключи форм слова. */
type CountKeysOf<S> =
  S extends LabelSet<string, unknown, infer P>
    ? {
        [K in keyof P]: P[K] extends readonly string[]
          ? 'count' extends P[K][number]
            ? K
            : never
          : never
      }[keyof P] &
        string
    : never

/** Ключ словаря таблицы с подписью владельца: `<владелец>.<ключ>`. */
export type PluginLabelKey = {
  [P in Owner]: `${P}.${keyof LabelsOf<PluginLabels[P]> & string}`
}[Owner]

type UnionToIntersection<U> = (
  U extends unknown ? (value: U) => void : never
) extends (value: infer I) => void
  ? I
  : never

/** Owner keys in the application's dictionary: a template string or a function, word forms `_<form>`. */
export type PluginDictionary = UnionToIntersection<
  {
    [P in Owner]: {
      [K in keyof LabelsOf<PluginLabels[P]> & string as `${P}.${K}`]?:
        LabelsOf<PluginLabels[P]>[K] | string
    } & {
      [K in `${P}.${CountKeysOf<PluginLabels[P]>}_${PluralForm}`]?: string
    }
  }[Owner]
>

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => string ? K : never
}[keyof T] &
  string

/** An owner's label set: calling it with the table's labels gives the owner's labels in its language. */
export interface LabelSet<
  TId extends string = string,
  T = unknown,
  TParams = Readonly<Record<string, readonly string[]>>,
> {
  (labels: object): T
  readonly id: TId
  /** Keys without word forms. */
  readonly keys: readonly string[]
  readonly defaults: Readonly<Record<string, string>>
  readonly params: TParams
}

const isFormOf = (
  key: string,
  params: Readonly<Record<string, readonly string[]>>,
) => {
  const cut = key.lastIndexOf('_')
  return (
    cut > 0 &&
    !!params[key.slice(0, cut)]?.includes('count') &&
    (PLURAL_FORMS as readonly string[]).includes(key.slice(cut + 1))
  )
}

/**
 * Declares an owner's labels: `T` is the labels type, `defaults` are English template strings
 * with `{name}` and `_<form>` word forms, `params` are the parameter names of function labels
 * in order.
 */
export const defineLabels =
  <T>() =>
  <
    TId extends string,
    const TParams extends Record<FunctionKeys<T>, readonly string[]>,
  >(
    id: TId,
    defaults: Record<keyof T & string, string> & Record<string, string>,
    params: TParams,
  ): LabelSet<TId, T, TParams> => {
    const own = params as Readonly<Record<string, readonly string[]>>
    const keys = Object.keys(defaults).filter(key => !isFormOf(key, own))
    const resolved = new WeakMap<object, T>()
    const set = (labels: object): T => {
      let value = resolved.get(labels)
      if (!value) {
        value = resolveOwnLabels(
          labelSourceOf(labels),
          `${id}.`,
          keys,
          defaults,
          own,
        ) as T
        resolved.set(labels, value)
      }
      return value
    }
    return Object.assign(set, { id, keys, defaults, params })
  }

/** Ключи словаря таблицы, которые объявляет набор: подписи и их формы слова. */
export const labelSetKeys = (set: LabelSet): string[] => {
  const params = set.params as Readonly<Record<string, readonly string[]>>
  const forms = Object.keys(set.defaults).filter(key => isFormOf(key, params))
  const counted = Object.entries(params)
    .filter(([, names]) => names.includes('count'))
    .flatMap(([key]) => PLURAL_FORMS.map(form => `${key}_${form}`))
  return [...new Set([...set.keys, ...forms, ...counted])].map(
    key => `${set.id}.${key}`,
  )
}

/**
 * Dictionary keys that neither the core nor the `sets` have. With `allLabelSets` it checks the
 * application's whole dictionary (ADR 0182, §9).
 */
export const unknownLabelKeys = (
  dictionary: object,
  sets: readonly LabelSet[] = [],
): string[] => {
  const owned = new Set(sets.flatMap(labelSetKeys))
  return Object.keys(dictionary).filter(
    key => !isCoreLabelKey(key) && !owned.has(key),
  )
}

/**
 * Неизвестные ключи, о которых таблица может судить (AN14): словарь общий на все таблицы,
 * поэтому ключ владельца не из её наборов — не опечатка.
 */
export const unknownTableLabelKeys = (
  dictionary: object,
  sets: readonly LabelSet[] = [],
): string[] =>
  unknownLabelKeys(dictionary, sets).filter(
    key => !key.includes('.') || sets.some(set => key.startsWith(`${set.id}.`)),
  )

export type { LabelSource }
