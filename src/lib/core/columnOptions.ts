/**
 * Column value options (ADR 0048, §1): `options` and `getOptionLabel` in the column definition.
 * A value's label is looked up in order: `options` → `getOptionLabel` → the cache of options
 * loaded by a lookup filter → the value itself as a string. Shared by cell rendering, quick
 * search, export and the filter, so plugins don't import each other.
 */

export type OptionValue = string | number | boolean

export interface ColumnOption {
  value: OptionValue
  label: string
  /** Server mode: the row count shown next to an option in the filter. */
  count?: number
  /**
   * Record of an option of an `object` column: `value` is its key, the editor saves the record
   * (ADR 0175, ED8).
   */
  record?: unknown
}

/** Searches lookup options by a string (ADR 0048, §5; ADR 0172, DT13). */
export type LoadOptions = (
  search: string,
  context: { signal: AbortSignal },
) => Promise<ColumnOption[]>

export interface ColumnOptionsDef {
  /** Column value options: labels in the cell, search, export and filter. */
  options?: ColumnOption[]
  /** Label of a value not in `options` (a lookup): `undefined` means no label. */
  getOptionLabel?: (value: OptionValue) => string | undefined
  /** Lookup: filter options for a search string; the column type's one takes precedence. */
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

/**
 * Подписи, загруженные фильтром справочника: на таблицу и колонку. Ключ — `store`: панель
 * получает таблицу из контекста колонки, а сводка тулбара — другой её объект.
 */
const loadedLabels = new WeakMap<object, Map<string, Map<unknown, string>>>()

const storeOf = (table: object) => (table as { store: object }).store

/** Запомнить подписи вариантов, загруженных `loadOptions` (ADR 0048, §5). */
export const rememberOptionLabels = (
  table: object,
  columnId: string,
  options: readonly ColumnOption[],
) => {
  const store = storeOf(table)
  let byColumn = loadedLabels.get(store)
  if (!byColumn) loadedLabels.set(store, (byColumn = new Map()))
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
  loadedLabels.get(storeOf(table))?.get(column.id)?.get(value)

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
