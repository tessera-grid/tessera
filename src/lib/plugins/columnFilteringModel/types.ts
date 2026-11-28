import type { LoadOptions } from '../../core/columnOptions'
import type { DateCellValue } from '../../core/dataTypes'
import type { OptionValue } from '../../core/columnOptions'

/** Column filter type (ADR 0045, §2; ADR 0047, §1; ADR 0048): a set of conditions and UI. */
export type ColumnFilterType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'lookup'

export type { DateCellValue, LoadOptions }

/** A column filter derived from its data type (ADR 0172, DT12): the kind and refinements. */
export type ColumnFilterDef =
  | ColumnFilterType
  | {
      type: ColumnFilterType
      /** Boolean: the "Empty" option — a boolean filter always has it (ADR 0172). */
      nullable?: boolean
      /** Date: a custom cell value → `Date`, milliseconds or ISO. */
      parse?: (value: unknown) => DateCellValue
      /** Lookup: options by the panel's search string. */
      loadOptions?: LoadOptions
    }

export type TextFilterOperator =
  'contains' | 'equals' | 'startsWith' | 'endsWith' | 'empty' | 'notEmpty'

export type NumberFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'between'
  | 'empty'
  | 'notEmpty'

/** Conditions without a value. */
export type EmptinessFilter = { operator: 'empty' } | { operator: 'notEmpty' }

export type TextFilter =
  | {
      operator: Exclude<TextFilterOperator, 'empty' | 'notEmpty'>
      value: string
    }
  | EmptinessFilter

/** Граница `null` у «между» — открытый интервал с этой стороны. */
/** Bound of a numeric condition; for a `numberString` column — a decimal string (ADR 0174). */
export type NumberBound = number | string

export type NumberFilter =
  | {
      operator: Exclude<NumberFilterOperator, 'between' | 'empty' | 'notEmpty'>
      value: NumberBound
    }
  | { operator: 'between'; value: [NumberBound | null, NumberBound | null] }
  | EmptinessFilter

/** "All" means no filter; "Empty" is an option of the boolean filter. */
export type BooleanFilter =
  { operator: 'equals'; value: boolean } | { operator: 'empty' }

export type DateFilterOperator =
  'on' | 'before' | 'after' | 'between' | 'preset' | 'empty' | 'notEmpty'

/** A date preset: computed from "today" at the moment it's applied (ADR 0047, §3). */
export type DateFilterPreset =
  'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'thisMonth' | 'thisYear'

/**
 * Date filter: `'YYYY-MM-DD'` or `'YYYY-MM-DDTHH:mm'` (wall-clock time in the `timeZone` zone);
 * a `null` bound of "between" is an open interval.
 */
export type DateFilter =
  | { operator: 'on' | 'before' | 'after'; value: string }
  | { operator: 'between'; value: [string | null, string | null] }
  | { operator: 'preset'; value: DateFilterPreset }
  | EmptinessFilter

export type OptionFilterOperator =
  'anyOf' | 'allOf' | 'noneOf' | 'empty' | 'notEmpty'

/** Option filter: selected values; "contains all" — only for `multiselect`. */
export type OptionFilter =
  | { operator: 'anyOf' | 'allOf' | 'noneOf'; value: OptionValue[] }
  | EmptinessFilter

/** Value of a column filter in the `columnFilters` slice. */
export type ColumnFilterValue =
  TextFilter | NumberFilter | BooleanFilter | DateFilter | OptionFilter
