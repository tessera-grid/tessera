import type { ColumnOption, OptionValue } from '../../core/columnOptions'

/** Тип фильтра колонки (ADR 0045, §2; ADR 0047, §1; ADR 0048): набор условий и UI. */
export type ColumnFilterType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'lookup'

/** Поиск вариантов справочника в панели фильтра (ADR 0048, §5). */
export type LoadOptions = (
  search: string,
  context: { signal: AbortSignal },
) => Promise<ColumnOption[]>

/** Значение даты в ячейке, которое разбирает фильтр дат (ADR 0047, §2). */
export type DateCellValue = Date | string | number | null | undefined

/** Поле `filter` в описании колонки: тип строкой или объектом с уточнениями. */
export type ColumnFilterDef =
  | ColumnFilterType
  | {
      type: ColumnFilterType
      /** Булево: вариант «Пусто». */
      nullable?: boolean
      /** Дата: своё значение ячейки → `Date`, миллисекунды или ISO. */
      parse?: (value: unknown) => DateCellValue
      /** Справочник: варианты по строке поиска панели. */
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

/** Условия без значения. */
type EmptinessFilter = { operator: 'empty' } | { operator: 'notEmpty' }

export type TextFilter =
  | {
      operator: Exclude<TextFilterOperator, 'empty' | 'notEmpty'>
      value: string
    }
  | EmptinessFilter

/** Граница `null` у «между» — открытый интервал с этой стороны. */
export type NumberFilter =
  | {
      operator: Exclude<NumberFilterOperator, 'between' | 'empty' | 'notEmpty'>
      value: number
    }
  | { operator: 'between'; value: [number | null, number | null] }
  | EmptinessFilter

/** «Все» — отсутствие фильтра; «Пусто» — только у колонки с `nullable`. */
export type BooleanFilter =
  { operator: 'equals'; value: boolean } | { operator: 'empty' }

export type DateFilterOperator =
  'on' | 'before' | 'after' | 'between' | 'preset' | 'empty' | 'notEmpty'

/** Пресет дат: считается от «сегодня» в момент применения (ADR 0047, §3). */
export type DateFilterPreset =
  'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'thisMonth' | 'thisYear'

/**
 * Фильтр даты: `'YYYY-MM-DD'` или `'YYYY-MM-DDTHH:mm'` (стенное время пояса
 * `timeZone`); граница `null` у «между» — открытый интервал.
 */
export type DateFilter =
  | { operator: 'on' | 'before' | 'after'; value: string }
  | { operator: 'between'; value: [string | null, string | null] }
  | { operator: 'preset'; value: DateFilterPreset }
  | EmptinessFilter

export type OptionFilterOperator =
  'anyOf' | 'allOf' | 'noneOf' | 'empty' | 'notEmpty'

/** Фильтр вариантов: выбранные значения; «содержит все» — только у `multiselect`. */
export type OptionFilter =
  | { operator: 'anyOf' | 'allOf' | 'noneOf'; value: OptionValue[] }
  | EmptinessFilter

/** Значение фильтра колонки в срезе `columnFilters`. */
export type ColumnFilterValue =
  TextFilter | NumberFilter | BooleanFilter | DateFilter | OptionFilter
