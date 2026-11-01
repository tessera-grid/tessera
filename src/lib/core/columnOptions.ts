/**
 * Варианты значений колонки (ADR 0048, §1): `options` и `getOptionLabel` в описании
 * колонки. Подпись значения ищется по порядку: `options` → `getOptionLabel` → кэш
 * вариантов, загруженных фильтром справочника → само значение строкой. Общая для
 * отрисовки ячейки, быстрого поиска, экспорта и фильтра — плагины не импортируют друг
 * друга.
 */

export type OptionValue = string | number | boolean

export interface ColumnOption {
  value: OptionValue
  label: string
  /** Серверный режим: число строк для счётчика варианта в фильтре. */
  count?: number
  /**
   * Запись варианта колонки `object`: `value` — её ключ, запись сохраняет редактор (ADR 0175,
   * ED8).
   */
  record?: unknown
}

/** Поиск вариантов справочника по строке (ADR 0048, §5; ADR 0172, DT13). */
export type LoadOptions = (
  search: string,
  context: { signal: AbortSignal },
) => Promise<ColumnOption[]>

export interface ColumnOptionsDef {
  /** Варианты значений колонки: подписи в ячейке, поиске, экспорте и фильтре. */
  options?: ColumnOption[]
  /** Подпись значения вне `options` (справочник): `undefined` — подписи нет. */
  getOptionLabel?: (value: OptionValue) => string | undefined
  /** Справочник: варианты фильтра по строке поиска; главнее — у типа колонки. */
  loadOptions?: LoadOptions
}

interface OptionsColumn {
  id: string
  columnDef: ColumnOptionsDef
}

const labelMaps = new WeakMap<ColumnOption[], Map<unknown, string>>()

const labelMapOf = (options: ColumnOption[]) => {
  let map = labelMaps.get(options)
  if (!map) {
    map = new Map(options.map(option => [option.value, option.label]))
    labelMaps.set(options, map)
  }
  return map
}

/** Подписи, загруженные фильтром справочника: на таблицу и колонку. */
const loadedLabels = new WeakMap<object, Map<string, Map<unknown, string>>>()

/** Запомнить подписи вариантов, загруженных `loadOptions` (ADR 0048, §5). */
export const rememberOptionLabels = (
  table: object,
  columnId: string,
  options: readonly ColumnOption[],
) => {
  let byColumn = loadedLabels.get(table)
  if (!byColumn) loadedLabels.set(table, (byColumn = new Map()))
  let labels = byColumn.get(columnId)
  if (!labels) byColumn.set(columnId, (labels = new Map()))
  for (const option of options) labels.set(option.value, option.label)
}

export const hasColumnOptions = (columnDef: ColumnOptionsDef) =>
  !!columnDef.options || !!columnDef.getOptionLabel

export const isEmptyOptionValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

/** Подпись одного значения вне `options`: `getOptionLabel`, затем кэш `loadOptions`. */
export const extraOptionLabel = (
  table: object,
  column: OptionsColumn,
  value: unknown,
): string | undefined =>
  column.columnDef.getOptionLabel?.(value as OptionValue) ??
  loadedLabels.get(table)?.get(column.id)?.get(value)

/** Подпись одного значения; `undefined` — подписи нет. */
export const knownOptionLabel = (
  table: object,
  column: OptionsColumn,
  value: unknown,
): string | undefined => {
  const { options } = column.columnDef
  return (
    (options ? labelMapOf(options).get(value) : undefined) ??
    extraOptionLabel(table, column, value)
  )
}

/** Подпись одного значения; без подписи — значение строкой. */
export const optionLabelOf = (
  table: object,
  column: OptionsColumn,
  value: unknown,
): string => knownOptionLabel(table, column, value) ?? String(value)

/**
 * Текст значения колонки с вариантами: подпись, у массива — подписи через «, »;
 * пустое — `''`. `undefined` — у колонки нет вариантов.
 */
export const optionTextOf = (
  table: object,
  column: OptionsColumn,
  value: unknown,
): string | undefined => {
  if (!hasColumnOptions(column.columnDef)) return undefined
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    return value.map(item => optionLabelOf(table, column, item)).join(', ')
  }
  return value === '' ? '' : optionLabelOf(table, column, value)
}
