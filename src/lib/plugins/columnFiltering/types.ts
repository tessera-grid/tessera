/** Тип фильтра колонки (ADR 0045, §2): задаёт набор условий и UI. */
export type ColumnFilterType = 'text' | 'number' | 'boolean'

/** Поле `filter` в описании колонки: тип строкой или объектом с уточнениями. */
export type ColumnFilterDef =
  ColumnFilterType | { type: ColumnFilterType; nullable?: boolean }

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

/** Значение фильтра колонки в срезе `columnFilters`. */
export type ColumnFilterValue = TextFilter | NumberFilter | BooleanFilter
