/**
 * Разрешитель подписей (ADR 0132): словарь «ключ → строка-шаблон или функция» поверх
 * английского словаря-шаблона становится подписями `TableLabels`, которые потребители
 * вызывают как функции.
 */
import { DEFAULT_LABELS, type TableLabels } from './labels'

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
  sortPriority: ['position', 'total'],
  columnsWithHidden: ['count'],
  selectedColumns: ['count'],
  exportView: ['features'],
  exportLoaded: ['count'],
  withActiveCount: ['name', 'count'],
  loadFailed: ['name'],
  actionFailedRetry: ['reason'],
  actionsRunning: ['names'],
  actionsFailed: ['names'],
  announceActionDone: ['name'],
  announceActionFailed: ['name', 'error'],
  menuBack: ['section'],
  announceMenuSection: ['section'],
  editCellValue: ['column'],
  announceSaveFailed: ['column', 'error'],
  announceExpandFailed: ['error'],
  announceMoveFailed: ['error'],
  announceColumnMoveFailed: ['error'],
  announceChildrenLoaded: ['count'],
  announceSortAscending: ['column'],
  announceSortDescending: ['column'],
  announceSelection: ['count'],
  announceCopy: ['count'],
  announceLoaded: ['count'],
  pageRange: ['from', 'to', 'total'],
  pageAnnouncement: ['page', 'pages'],
  loadedRows: ['count'],
  loadedRowsOf: ['count', 'total'],
  loadedRowsShort: ['count'],
  loadedRowsOfShort: ['count', 'total'],
  selectedRowsShort: ['count'],
  selectedRowsHiddenShort: ['count'],
  filteredRowsShort: ['shown', 'total'],
  groupRowCount: ['count'],
  announceLoadErrorReason: ['reason'],
  announceLoadFailedReason: ['reason'],
  announceMoreLoaded: ['count'],
  selectedRows: ['count'],
  selectedAllExcept: ['count'],
  selectedAllExceptShort: ['count'],
  selectedRowsHidden: ['count'],
  searchColumnsHint: ['columns'],
  filtersActive: ['count'],
  filtersActiveHidden: ['count', 'hidden'],
  removeFilter: ['column'],
  announceFilteredRows: ['count'],
  filteredRows: ['shown', 'total'],
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
 * Словарь подписей приложения: значение — строка-шаблон с `{имя}` или функция, как в
 * `TableLabels`; у подписей с `count` — ещё ключи форм слова `<ключ>_<форма>`.
 */
export type LabelDictionary = {
  [K in LabelKey]?: TableLabels[K] | string
} & {
  [K in `${CountKey}_${PluralForm}`]?: string
}

const isFunctionKey = (key: string): key is FunctionKey => key in LABEL_PARAMS

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

/** Ключи словаря, которых у таблицы нет: опечатки словаря из JSON (LC8). */
export const unknownLabelKeys = (dictionary: object): string[] =>
  Object.keys(dictionary).filter(
    key => !(LABEL_KEYS as string[]).includes(key) && !isFormKey(key),
  )

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

/**
 * Подписи таблицы: словарь приложения поверх английского словаря-шаблона. Подписи с
 * параметрами — функции с позиционными параметрами, как в `TableLabels`.
 */
export const resolveLabels = (
  dictionary: LabelDictionary | undefined,
  locale: string,
): TableLabels => {
  const own = (dictionary ?? {}) as Record<string, unknown>
  const defaults = DEFAULT_LABELS as Record<string, unknown>
  const labels: Record<string, unknown> = {}
  for (const key of LABEL_KEYS) {
    const value = own[key]
    if (typeof value === 'function') {
      labels[key] = value
    } else if (!isFunctionKey(key)) {
      labels[key] = typeof value === 'string' ? value : defaults[key]
    } else {
      const names: readonly string[] = LABEL_PARAMS[key]
      labels[key] = (...args: unknown[]) => {
        const params = Object.fromEntries(
          names.map((name, index) => [name, args[index]]),
        )
        const template =
          pickTemplate(own, key, params.count, locale) ??
          pickTemplate(defaults, key, params.count, locale) ??
          ''
        return formatTemplate(template, params, locale)
      }
    }
  }
  return labels as unknown as TableLabels
}

/** Английские подписи таблицы без словаря приложения. */
export const ENGLISH_LABELS = resolveLabels(undefined, DEFAULT_LOCALE)
