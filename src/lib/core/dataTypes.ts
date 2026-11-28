/**
 * Тип данных колонки (ADR 0172): встроенные типы, реестр `dataTypes` таблицы и разрешение
 * типа колонки — один раз на описание колонки и реестр. Ячейка, плагины и плагин автора
 * узнают тип только через `column.getDataType()`.
 */
import type { LoadOptions } from './columnOptions'
import { logWarn } from '../util/logger'

export const BUILT_IN_DATA_TYPES = [
  'text',
  'number',
  'boolean',
  'date',
  'dateTime',
  'dateString',
  'dateTimeString',
  'select',
  'multiSelect',
  'object',
  'numberString',
] as const

export type BuiltInDataType = (typeof BUILT_IN_DATA_TYPES)[number]

/** Column type name: built-in or from the `dataTypes` registry. */
export type DataTypeName = BuiltInDataType | (string & {})

export type DataTypeAlign = 'start' | 'center' | 'end'

/** `Intl.NumberFormat` or `Intl.DateTimeFormat` options, depending on the base type. */
export type DataTypeFormat = Intl.NumberFormatOptions &
  Intl.DateTimeFormatOptions

/** A custom-format date cell value parsed into a date: `Date`, milliseconds or ISO string. */
export type DateCellValue = Date | string | number | null | undefined

/** Поля, которые задаются у типа и у колонки; поле колонки главнее (DT2). */
export interface DataTypeFields<TData = any> {
  /** `Intl` options in the table's language (DT7). */
  format?: DataTypeFormat
  /** Value text; takes precedence over `format` (DT7). */
  formatValue?: (value: unknown, row: TData) => string
  /** Alignment in the cell and header; start by default (DT9). */
  align?: DataTypeAlign
  /** Custom parsing of editor text (ADR 0139). */
  parseValue?: (text: string, row: TData) => unknown
  /** Custom-format cell value → date: display, sorting, filter and export (DT10, DT13). */
  parseDate?: (value: unknown) => DateCellValue
  /** Date → custom-format cell value: how the date editor writes it (ADR 0175, ED15). */
  formatDate?: (date: Date) => unknown
  /** Lookup: filter options for a search string (DT13). */
  loadOptions?: LoadOptions
  /** Key of an `object` record: equality, filter and grouping; the `id` field by default (TY1). */
  getKey?: (value: any) => unknown
  /** Label of an `object` record; `label` by default, then `name`, then the key (TY1). */
  getLabel?: (value: any) => string
}

/** An entry of the `dataTypes` registry: a custom type or an override of built-in fields. */
export interface DataTypeDefinition<TData = any> extends DataTypeFields<TData> {
  /** Type whose fields are inherited unless overridden; without it a custom type is text. */
  extends?: DataTypeName
}

export type DataTypeRegistry = Record<string, DataTypeDefinition>

/** Итог разрешения типа колонки (DT3). */
export interface ResolvedDataType {
  name: string
  base: BuiltInDataType
  definition: DataTypeFields
}

const BUILT_IN = new Set<string>(BUILT_IN_DATA_TYPES)

export const isBuiltInDataType = (name: string): name is BuiltInDataType =>
  BUILT_IN.has(name)

const FIELDS = [
  'format',
  'formatValue',
  'align',
  'parseValue',
  'parseDate',
  'formatDate',
  'loadOptions',
  'getKey',
  'getLabel',
] as const

const ownFields = (source: object): DataTypeFields =>
  Object.fromEntries(
    FIELDS.flatMap(key => {
      const value = (source as Record<string, unknown>)[key]
      return value === undefined ? [] : [[key, value]]
    }),
  )

/** Поля записи реестра: все, кроме `extends`, — и поля, которые объявили плагины (`editor`). */
const entryFields = (entry: DataTypeDefinition): DataTypeFields =>
  Object.fromEntries(
    Object.entries(entry).filter(
      ([key, value]) => key !== 'extends' && value !== undefined,
    ),
  )

interface TypedColumn {
  columnDef: { dataType?: DataTypeName } & DataTypeFields
}

interface TypesTable {
  options: { dataTypes?: DataTypeRegistry }
}

/** Цепочка записей от типа колонки к встроенному; `undefined` — неизвестное имя или цикл. */
const chainOf = (
  table: TypesTable,
  name: string,
  registry: DataTypeRegistry,
): { base: BuiltInDataType; chain: DataTypeDefinition[] } | undefined => {
  const chain: DataTypeDefinition[] = []
  const seen = new Set<string>()
  let current = name
  for (;;) {
    if (seen.has(current)) {
      logWarn(
        table as never,
        `dataType "${name}": extends forms a cycle through "${current}" — the column behaves as untyped`,
        `dataType-cycle:${name}`,
      )
      return undefined
    }
    seen.add(current)
    const entry = registry[current]
    if (isBuiltInDataType(current)) {
      if (entry) chain.push(entry)
      return { base: current, chain }
    }
    if (!entry) {
      logWarn(
        table as never,
        `dataType "${current}" is neither built in nor in dataTypes — the column behaves as untyped`,
        `dataType-unknown:${current}`,
      )
      return undefined
    }
    chain.push(entry)
    if (entry.extends === undefined) return { base: 'text', chain }
    current = entry.extends
  }
}

const EMPTY_REGISTRY: DataTypeRegistry = {}
const resolvedCache = new WeakMap<
  object,
  { registry: DataTypeRegistry; value: ResolvedDataType | undefined }
>()

/** Тип колонки: раз на описание колонки и реестр (DT3). */
export const resolveDataType = (
  table: TypesTable,
  column: TypedColumn,
): ResolvedDataType | undefined => {
  const { columnDef } = column
  const registry = table.options.dataTypes ?? EMPTY_REGISTRY
  const cached = resolvedCache.get(columnDef)
  if (cached?.registry === registry) return cached.value
  const name = columnDef.dataType
  let value: ResolvedDataType | undefined
  if (name !== undefined) {
    const found = chainOf(table, name, registry)
    if (found) {
      const definition: DataTypeFields = {}
      for (let i = found.chain.length - 1; i >= 0; i--) {
        Object.assign(definition, entryFields(found.chain[i]!))
      }
      Object.assign(definition, ownFields(columnDef))
      value = { name, base: found.base, definition }
    }
  }
  resolvedCache.set(columnDef, { registry, value })
  return value
}
