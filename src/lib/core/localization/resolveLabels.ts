/**
 * Разрешитель подписей (ADR 0132): словарь «ключ → строка-шаблон или функция» поверх
 * английского словаря-шаблона становится подписями `TableLabels`, которые потребители
 * вызывают как функции.
 */
import { DEFAULT_LABELS, type TableLabels } from './labels'
import type { LabelSet, PluginDictionary } from './pluginLabels'

/** Язык форм слова, чисел и списков подписей по умолчанию (ADR 0132, LC5). */
export const DEFAULT_LOCALE = 'en-US'

type LabelKey = keyof TableLabels

type FunctionKey = {
  [K in LabelKey]: TableLabels[K] extends (...args: never[]) => string
    ? K
    : never
}[LabelKey]

/**
 * Имена параметров подписей-функций по порядку аргументов: по ним строка-шаблон
 * получает `{имя}`. Число, от которого зависит форма слова, всегда `count`.
 */
export const LABEL_PARAMS = {
  withActiveCount: ['name', 'count'],
  viewSettingsActive: ['count'],
  viewSettingsActiveCount: ['count'],
  viewSettingsDraftCount: ['count'],
  viewSettingsSectionName: ['section', 'value'],
  loadFailed: ['name'],
  actionFailedRetry: ['reason'],
  actionsRunning: ['names'],
  actionsFailed: ['names'],
  announceActionDone: ['name'],
  announceActionFailed: ['name', 'error'],
  cancelAction: ['name'],
  announceActionCancelled: ['name'],
  pendingAction: ['name'],
  pasteQuestionValue: ['value'],
  pasteQuestionCount: ['count'],
  writeQuestion: ['count'],
  writeOverLimit: ['count', 'max'],
  menuBack: ['section'],
  announceMenuSection: ['section'],
  announceStillSaving: ['name'],
  actionDraft: ['action'],
  actionActiveDraft: ['action'],
  failureTargetCell: ['column', 'row'],
  failureTargetRow: ['row'],
  announceSortAscending: ['column'],
  announceSortDescending: ['column'],
  announceLoaded: ['count'],
  groupRowCount: ['count'],
  announceLoadErrorReason: ['reason'],
  announceLoadFailedReason: ['reason'],
  announceFilteredRows: ['count'],
  announceRowsAdded: ['count'],
  announceRowsRemoved: ['count'],
} as const satisfies Record<FunctionKey, readonly string[]>

/** Формы слова по числу (`Intl.PluralRules`) и `zero` для нуля в любом языке. */
export const PLURAL_FORMS = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
] as const

type PluralForm = (typeof PLURAL_FORMS)[number]

/** Подписи, у которых есть параметр `count`: только у них бывают ключи форм слова. */
type CountKey = {
  [K in FunctionKey]: 'count' extends (typeof LABEL_PARAMS)[K][number]
    ? K
    : never
}[FunctionKey]

/**
 * The application's label dictionary: a value is a template string with `{name}` or a function,
 * as in `TableLabels`; labels with `count` also have word-form keys `<key>_<form>`; owner labels
 * use `<owner>.<key>` keys (ADR 0182, §8).
 */
export type LabelDictionary = {
  [K in LabelKey]?: TableLabels[K] | string
} & {
  [K in `${CountKey}_${PluralForm}`]?: string
} & PluginDictionary

/**
 * A dictionary without keys missing from `LabelDictionary`: TypeScript flags an excess property
 * only on a literal; this flags it on a JSON module too (ADR 0182, AN21). A type with arbitrary
 * keys (`Record<string, string>`) passes: the table checks it in development.
 */
export type ExactLabelDictionary<D> = D & {
  [K in Exclude<keyof D, keyof LabelDictionary>]: string extends K
    ? unknown
    : never
}

const COUNT_KEYS = new Set<string>(
  Object.entries(LABEL_PARAMS)
    .filter(([, params]) => (params as readonly string[]).includes('count'))
    .map(([key]) => key),
)

/** Ключ формы слова `<подпись с count>_<форма>`. */
const isFormKey = (key: string) => {
  const cut = key.lastIndexOf('_')
  return (
    cut > 0 &&
    COUNT_KEYS.has(key.slice(0, cut)) &&
    (PLURAL_FORMS as readonly string[]).includes(key.slice(cut + 1))
  )
}

/** Ключи подписей таблицы — ключи английского словаря без форм слова. */
const LABEL_KEYS = Object.keys(DEFAULT_LABELS).filter(
  key => !isFormKey(key),
) as LabelKey[]

/** Ключ словаря ядра: подпись ядра или её форма слова. */
export const isCoreLabelKey = (key: string) =>
  (LABEL_KEYS as string[]).includes(key) || isFormKey(key)

export type { LabelSet }

const numberFormats = new Map<string, Intl.NumberFormat>()
const listFormats = new Map<string, Intl.ListFormat>()
const pluralRules = new Map<string, Intl.PluralRules>()

const cached = <T>(cache: Map<string, T>, locale: string, make: () => T) => {
  let value = cache.get(locale)
  if (!value) {
    value = make()
    cache.set(locale, value)
  }
  return value
}

const formatValue = (value: unknown, locale: string): string => {
  if (typeof value === 'number') {
    return cached(
      numberFormats,
      locale,
      () => new Intl.NumberFormat(locale),
    ).format(value)
  }
  if (Array.isArray(value)) {
    return cached(
      listFormats,
      locale,
      () => new Intl.ListFormat(locale),
    ).format(value.map(String))
  }
  return String(value)
}

/** `{имя}` → значение параметра; без такого параметра подстановка остаётся текстом. */
export const formatTemplate = (
  template: string,
  params: Record<string, unknown>,
  locale: string,
): string =>
  template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : formatValue(params[name], locale),
  )

/** Шаблон формы слова по `count`: `_zero` при нуле, форма языка, затем ключ без суффикса. */
const pickTemplate = (
  source: Record<string, unknown>,
  key: string,
  count: unknown,
  locale: string,
): string | undefined => {
  if (typeof count === 'number') {
    const form = cached(
      pluralRules,
      locale,
      () => new Intl.PluralRules(locale),
    ).select(count)
    const forms = count === 0 ? ['zero', form] : [form]
    for (const suffix of forms) {
      const value = source[`${key}_${suffix}`]
      if (typeof value === 'string') return value
    }
  }
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

/** Словарь приложения и язык, по которым разрешены подписи: наборы владельцев читают их же. */
export const LABEL_SOURCE = Symbol('tessera.labelSource')

export interface LabelSource {
  own: Record<string, unknown>
  locale: string
}

/** Источник подписей: у объекта без него — английский словарь. */
export const labelSourceOf = (labels: object): LabelSource =>
  (labels as { [LABEL_SOURCE]?: LabelSource })[LABEL_SOURCE] ?? {
    own: {},
    locale: DEFAULT_LOCALE,
  }

/**
 * Подписи одного владельца: ключ словаря — `<prefix><ключ>`, без значения в словаре —
 * английское значение владельца; подписи с параметрами — функции с позиционными параметрами.
 */
export const resolveOwnLabels = (
  source: LabelSource,
  prefix: string,
  keys: readonly string[],
  defaults: Record<string, unknown>,
  params: Record<string, readonly string[]>,
): Record<string, unknown> => {
  const { own, locale } = source
  const labels: Record<string, unknown> = {}
  for (const key of keys) {
    const value = own[prefix + key]
    if (typeof value === 'function') {
      labels[key] = value
    } else if (!(key in params)) {
      labels[key] = typeof value === 'string' ? value : defaults[key]
    } else {
      const names = params[key]!
      labels[key] = (...args: unknown[]) => {
        const values = Object.fromEntries(
          names.map((name, index) => [name, args[index]]),
        )
        const template =
          pickTemplate(own, prefix + key, values.count, locale) ??
          pickTemplate(defaults, key, values.count, locale) ??
          ''
        return formatTemplate(template, values, locale)
      }
    }
  }
  return labels
}

/**
 * Подписи таблицы: словарь приложения поверх английского словаря-шаблона. Подписи с
 * параметрами — функции с позиционными параметрами, как в `TableLabels`. Подписи плагинов
 * разрешает их набор (`defineLabels`) из того же словаря.
 */
export const resolveLabels = (
  dictionary: LabelDictionary | undefined,
  locale: string,
): TableLabels => {
  const source: LabelSource = {
    own: (dictionary ?? {}) as Record<string, unknown>,
    locale,
  }
  const labels = resolveOwnLabels(
    source,
    '',
    LABEL_KEYS,
    DEFAULT_LABELS as Record<string, unknown>,
    LABEL_PARAMS,
  )
  return Object.assign(labels, {
    [LABEL_SOURCE]: source,
  }) as unknown as TableLabels
}

/** Английские подписи таблицы без словаря приложения. */
export const ENGLISH_LABELS = resolveLabels(undefined, DEFAULT_LOCALE)
