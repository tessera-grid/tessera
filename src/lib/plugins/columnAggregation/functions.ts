/**
 * Какие функции у сводки колонки и как они называются (ADR 0230, §2–§3): список — поле колонки
 * `aggregationFns`, иначе поле её типа в реестре `dataTypes`, иначе встроенный список по базовому
 * типу; функция по умолчанию входит всегда. Пункт есть, когда результат виден.
 */
import { resolveDataType } from '../../core/dataTypes'
import type { BuiltInDataType } from '../../core/dataTypes'
import type { TableLabels } from '../../core/localization'
import { serviceColumnOf } from '../../core/createColumns'
import {
  chosenAggregationOf,
  type ColumnAggregationFunction,
  defaultAggregationOf,
} from './feature'
import { columnAggregationLabels } from './labels'

const NUMBER = ['sum', 'mean', 'median', 'min', 'max', 'count'] as const
const DATE = ['min', 'max', 'count'] as const
const COUNTS = ['count', 'uniqueCount'] as const

/** Встроенные списки по базовому типу (§2): строковые даты и десятичная строка — только счёт. */
const BY_BASE: Record<BuiltInDataType, readonly string[]> = {
  number: NUMBER,
  date: DATE,
  dateTime: DATE,
  text: COUNTS,
  select: COUNTS,
  multiSelect: COUNTS,
  boolean: COUNTS,
  object: COUNTS,
  numberString: COUNTS,
  dateString: COUNTS,
  dateTimeString: COUNTS,
}

export interface AggregationColumn {
  id: string
  columnDef: {
    aggregationFns?: readonly string[]
    dataType?: string
  } & Record<string, unknown>
  getIsActionsColumn?: () => boolean
}

interface FunctionsTable {
  options: {
    dataTypes?: never
    locale?: string
    enableFooter?: boolean
    columnAggregationFunctions?: Record<string, ColumnAggregationFunction>
    canSummarizeColumn?: (column: AggregationColumn) => boolean
  }
  atoms: { grouping?: { get: () => readonly string[] | undefined } }
}

/** Имя функции колонки по умолчанию; `'auto'` и определения без имени — не выбор. */
export const defaultNameOf = (column: AggregationColumn): string | null => {
  const value = defaultAggregationOf(column)
  if (typeof value === 'string') return value === 'auto' ? null : value
  const named = (value as { name?: unknown } | undefined)?.name
  return typeof named === 'string' ? named : null
}

/** Действующая функция колонки: выбор пользователя, иначе функция по умолчанию. */
export const currentNameOf = (
  table: unknown,
  column: AggregationColumn,
): string | null => {
  const chosen = chosenAggregationOf(table, column.id)
  return chosen === undefined ? defaultNameOf(column) : chosen
}

/** Функции колонки по порядку списка; функция по умолчанию — первой, если её нет в списке. */
export const functionsOf = (
  table: unknown,
  column: AggregationColumn,
): string[] => {
  const t = table as FunctionsTable
  if (serviceColumnOf(column.columnDef) || column.getIsActionsColumn?.())
    return []
  const type = resolveDataType(t as never, column as never)
  const own = column.columnDef.aggregationFns
  const listed =
    own ??
    (type?.definition as { aggregationFns?: readonly string[] } | undefined)
      ?.aggregationFns ??
    (type ? BY_BASE[type.base] : COUNTS)
  const names = [...listed]
  const custom = t.options.columnAggregationFunctions ?? {}
  if (!own) {
    for (const [name, fn] of Object.entries(custom)) {
      if (
        type &&
        fn.dataTypes?.some(item => item === type.name || item === type.base) &&
        !names.includes(name)
      ) {
        names.push(name)
      }
    }
  }
  const fallback = defaultNameOf(column)
  if (fallback && !names.includes(fallback)) names.unshift(fallback)
  return names
}

/** Подпись функции: своя — текст приложения, встроенная — из словаря, иначе имя. */
export const functionLabel = (
  table: unknown,
  name: string,
  labels: TableLabels,
): string => {
  const custom = (table as FunctionsTable).options.columnAggregationFunctions?.[
    name
  ]
  if (custom) return custom.label
  const own = columnAggregationLabels(labels) as unknown as Record<
    string,
    unknown
  >
  const text = own[name]
  return typeof text === 'string' ? text : name
}

/** Результат сводки виден: строка итогов или группировка (ADR 0230, §3). */
export const summaryShown = (table: unknown): boolean => {
  const t = table as FunctionsTable
  return (
    t.options.enableFooter === true ||
    (t.atoms.grouping?.get()?.length ?? 0) > 0
  )
}

/** У колонки есть пункт «Сводка» (SU6). */
export const canSummarize = (
  table: unknown,
  column: AggregationColumn,
): boolean =>
  summaryShown(table) &&
  functionsOf(table, column).length > 0 &&
  (table as FunctionsTable).options.canSummarizeColumn?.(column) !== false
