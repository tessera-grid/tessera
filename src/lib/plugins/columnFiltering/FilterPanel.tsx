/**
 * Панель фильтра колонки (ADR 0045, §3–§4): условие, значение, «Сбросить».
 * Ввод применяется через `debounceMs` после последнего нажатия, выбор условия и
 * булева значения — сразу. Нечисловой ввод в поле числа не применяется. В серверном
 * режиме условие уходит кнопкой «Применить» и Enter, набранное хранится по колонке
 * (ADR 0154).
 */
import { type RefObject, Suspense, useId } from 'react'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'

import { Button } from '../../ui/Button'
import { setColumnFilterByUser } from '../../shared/filtering/filtering'
import type { ActionPanelControls } from '../../core/headerActions'
import { useLocalization } from '../../core/localization'
import { parseLocaleDecimal, parseLocaleNumber } from '../../util/parseNumber'
import { preloadable } from '../../core/preloadable'
import { useDebouncedCallback } from '../../util/useDebouncedCallback'
import {
  columnFilterDefOf,
  type FilterDefColumn,
  filterTypeOf,
} from '../columnFilteringModel/conditions'
import { type FilterOperator, operatorLabel } from './describeFilter'
import { OperatorSelect } from './OperatorSelect'
import type {
  ColumnFilterValue,
  NumberFilterOperator,
  TextFilterOperator,
} from '../columnFilteringModel/types'

import styles from './FilterPanel.module.css'
import { FilterApply } from './FilterApply'
import { FilterFailure } from './FilterFailure'
import { useFilterDraft } from './filterDraft'
import { columnFilteringLabels } from './labels'

export interface FilterColumn extends FilterDefColumn {
  id: string
  getFilterValue: () => unknown
}

const DateFilterPanel = preloadable(() =>
  import('./DateFilterPanel').then(m => m.DateFilterPanel),
)

const OptionFilterPanel = preloadable(() =>
  import('./OptionFilterPanel').then(m => m.OptionFilterPanel),
)

/** Загрузка модуля панели под тип фильтра — календаря или чек-листа вариантов. */
export const preloadFilterTypePanel = (
  type: string | undefined,
): Promise<unknown> | undefined => {
  if (type === 'select' || type === 'multiselect' || type === 'lookup') {
    return OptionFilterPanel.reload()
  }
  if (type === 'date' || type === 'datetime') return DateFilterPanel.reload()
  return undefined
}

export interface FilterPanelProps {
  table: unknown
  column: FilterColumn
  debounceMs: number
  controls: ActionPanelControls
}

type Operator = FilterOperator

const TEXT_OPERATORS: TextFilterOperator[] = [
  'contains',
  'equals',
  'startsWith',
  'endsWith',
  'empty',
  'notEmpty',
]

const NUMBER_OPERATORS: NumberFilterOperator[] = [
  'equals',
  'notEquals',
  'lessThan',
  'lessThanOrEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'between',
  'empty',
  'notEmpty',
]

const needsValue = (operator: Operator) =>
  operator !== 'empty' && operator !== 'notEmpty'

/** Число из ввода по языку таблицы: `null` — пусто, `NaN` — не число (ADR 0172, DT14). */
export const parseNumberInput = parseLocaleNumber

/** Граница из ввода: у `numberString` — десятичная строка без float (ADR 0174, TY11). */
const boundOf = (
  input: string,
  locale: string | undefined,
  decimal: boolean,
) => {
  if (!decimal) return parseNumberInput(input, locale)
  const value = parseLocaleDecimal(input, locale)
  return value === undefined ? Number.NaN : value
}

const isInvalidNumber = (input: string, locale?: string, decimal = false) =>
  Number.isNaN(boundOf(input, locale, decimal) as number)

interface Draft {
  operator: Operator
  value: string
  from: string
  to: string
}

const draftOf = (
  type: 'text' | 'number',
  current: ColumnFilterValue | undefined,
): Draft => {
  const operator = (current?.operator ??
    (type === 'text' ? 'contains' : 'equals')) as Operator
  const value = current && 'value' in current ? current.value : undefined
  if (Array.isArray(value)) {
    return {
      operator,
      value: '',
      from: value[0] === null ? '' : String(value[0]),
      to: value[1] === null ? '' : String(value[1]),
    }
  }
  return {
    operator,
    value: value === undefined ? '' : String(value),
    from: '',
    to: '',
  }
}

/** Значение фильтра из черновика; `null` — ввод не применим (нечисловой). */
const filterOf = (
  type: 'text' | 'number',
  draft: Draft,
  locale?: string,
  decimal = false,
): ColumnFilterValue | undefined | null => {
  const { operator } = draft
  if (!needsValue(operator)) {
    return { operator } as ColumnFilterValue
  }
  if (type === 'text') {
    return { operator, value: draft.value } as ColumnFilterValue
  }
  if (operator === 'between') {
    const from = boundOf(draft.from, locale, decimal)
    const to = boundOf(draft.to, locale, decimal)
    if (Number.isNaN(from as number) || Number.isNaN(to as number)) return null
    if (from === null && to === null) return undefined
    return { operator, value: [from, to] }
  }
  const value = boundOf(draft.value, locale, decimal)
  if (Number.isNaN(value as number)) return null
  if (value === null) return undefined
  return { operator, value } as ColumnFilterValue
}

const ConditionPanel = ({
  type,
  table,
  column,
  debounceMs,
  controls,
}: FilterPanelProps & { type: 'text' | 'number' }) => {
  const labels = useLocalization()
  const errorId = useId()
  const { locale } = (table as { options: { locale?: string } }).options
  const decimal =
    (
      column as { getDataType?: () => { base: string } | undefined }
    ).getDataType?.()?.base === 'numberString'
  const filterDraft = useFilterDraft({
    table,
    columnId: column.id,
    current: column.getFilterValue(),
    draftOf: current => draftOf(type, current),
    filterOf: next => filterOf(type, next, locale, decimal),
  })
  const { draft, setDraft, server } = filterDraft
  const apply = useDebouncedCallback((next: Draft) => {
    const filter = filterOf(type, next, locale, decimal)
    if (filter !== null) setColumnFilterByUser(table, column.id, filter)
  }, debounceMs)

  const update = (patch: Partial<Draft>, immediate = false) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    // На сервере условие уходит кнопкой «Применить» (ADR 0154).
    if (server) return
    apply.schedule(next)
    if (immediate) apply.flush()
  }

  const reset = () => {
    apply.cancel()
    setColumnFilterByUser(table, column.id, undefined)
    setDraft(draftOf(type, undefined))
    filterDraft.forget()
  }

  const operators = type === 'text' ? TEXT_OPERATORS : NUMBER_OPERATORS
  const labelOf = (operator: Operator) => operatorLabel(operator, labels)

  const numberField = (
    key: 'value' | 'from' | 'to',
    label: string,
    focusRef?: RefObject<HTMLElement | null>,
  ) => {
    const invalid =
      type === 'number' && isInvalidNumber(draft[key], locale, decimal)
    return (
      <input
        ref={focusRef as RefObject<HTMLInputElement | null> | undefined}
        className={styles.input}
        type="text"
        inputMode={type === 'number' ? 'decimal' : undefined}
        aria-label={label}
        placeholder={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        value={draft[key]}
        onChange={event => update({ [key]: event.target.value })}
        onKeyDown={event => {
          // Enter отправляет условие, как «Применить» (ADR 0154).
          if (server && event.key === 'Enter' && filterDraft.dirty) {
            event.preventDefault()
            filterDraft.commit()
          }
        }}
        data-testid={`filter-${key}`}
      />
    )
  }

  const invalid =
    type === 'number' &&
    (draft.operator === 'between'
      ? isInvalidNumber(draft.from, locale, decimal) ||
        isInvalidNumber(draft.to, locale, decimal)
      : needsValue(draft.operator) &&
        isInvalidNumber(draft.value, locale, decimal))

  return (
    <div className={styles.panel} data-testid="filter-panel">
      <OperatorSelect
        value={draft.operator}
        operators={operators}
        labelOf={labelOf}
        onChange={operator => update({ operator }, true)}
      />
      {draft.operator === 'between' ? (
        <div className={styles.range}>
          {numberField(
            'from',
            columnFilteringLabels(labels).filterFrom,
            controls.initialFocusRef,
          )}
          {numberField('to', columnFilteringLabels(labels).filterTo)}
        </div>
      ) : (
        needsValue(draft.operator) &&
        numberField(
          'value',
          columnFilteringLabels(labels).filterValue,
          controls.initialFocusRef,
        )
      )}
      {invalid && (
        <span id={errorId} className={styles.error} role="alert">
          {columnFilteringLabels(labels).filterInvalidNumber}
        </span>
      )}
      <div className={styles.footer}>
        <FilterFailure table={table} columnId={column.id} />
        <Button variant="ghost" onClick={reset} data-testid="filter-reset">
          {columnFilteringLabels(labels).filterReset}
        </Button>
        {server && <FilterApply {...filterDraft} />}
      </div>
    </div>
  )
}

type BooleanChoice = 'all' | 'yes' | 'no' | 'empty'

const choiceOf = (current: ColumnFilterValue | undefined): BooleanChoice => {
  if (!current) return 'all'
  if (current.operator === 'empty') return 'empty'
  return 'value' in current && current.value === true ? 'yes' : 'no'
}

const filterOfChoice = (
  choice: BooleanChoice,
): ColumnFilterValue | undefined => {
  switch (choice) {
    case 'all':
      return undefined
    case 'yes':
      return { operator: 'equals', value: true }
    case 'no':
      return { operator: 'equals', value: false }
    case 'empty':
      return { operator: 'empty' }
  }
}

const BooleanPanel = ({ table, column, controls }: FilterPanelProps) => {
  const labels = useLocalization()
  const labelId = useId()
  const nullable = true
  const filterDraft = useFilterDraft({
    table,
    columnId: column.id,
    current: column.getFilterValue(),
    draftOf: choiceOf,
    filterOf: filterOfChoice,
  })
  const { draft: value, server } = filterDraft
  const choices: [BooleanChoice, string][] = [
    ['all', columnFilteringLabels(labels).filterAll],
    ['yes', columnFilteringLabels(labels).filterYes],
    ['no', columnFilteringLabels(labels).filterNo],
    ...(nullable
      ? [
          ['empty', columnFilteringLabels(labels).filterEmpty] as [
            BooleanChoice,
            string,
          ],
        ]
      : []),
  ]

  return (
    <div className={styles.panel} data-testid="filter-panel">
      <span id={labelId} hidden>
        {columnFilteringLabels(labels).filterValue}
      </span>
      <RadioGroup
        value={value}
        onValueChange={next => {
          const nextChoice = next as BooleanChoice
          filterDraft.setDraft(nextChoice)
          if (!server) {
            setColumnFilterByUser(table, column.id, filterOfChoice(nextChoice))
          }
        }}
        aria-labelledby={labelId}
        className={styles.options}
        data-testid="filter-boolean"
      >
        {choices.map(([id, label]) => (
          <label key={id} className={styles.option}>
            <Radio.Root
              value={id}
              className={styles.radio}
              data-value={id}
              ref={
                id === value
                  ? (controls.initialFocusRef as RefObject<HTMLButtonElement | null>)
                  : undefined
              }
            >
              <Radio.Indicator className={styles.dot} />
            </Radio.Root>
            <span>{label}</span>
          </label>
        ))}
      </RadioGroup>
      {server ? (
        <div className={styles.footer}>
          <FilterFailure table={table} columnId={column.id} />
          <FilterApply {...filterDraft} />
        </div>
      ) : (
        <FilterFailure table={table} columnId={column.id} footer />
      )}
    </div>
  )
}

export const FilterPanel = (props: FilterPanelProps) => {
  const type = filterTypeOf(columnFilterDefOf(props.column))
  if (type === 'boolean') return <BooleanPanel {...props} />
  // Календарь — ленивый модуль: грид без колонок дат его не загружает (DF14).
  // Чек-лист вариантов — тоже ленивый модуль (ADR 0048, SF22).
  if (type === 'select' || type === 'multiselect' || type === 'lookup') {
    return (
      <Suspense
        fallback={
          <div
            className={styles.panel}
            aria-busy="true"
            data-testid="filter-options-loading"
          />
        }
      >
        <OptionFilterPanel.Component {...props} type={type} />
      </Suspense>
    )
  }
  if (type === 'date' || type === 'datetime') {
    return (
      <Suspense
        fallback={
          <div
            className={styles.panel}
            aria-busy="true"
            data-testid="filter-date-loading"
          />
        }
      >
        <DateFilterPanel.Component {...props} type={type} />
      </Suspense>
    )
  }
  if (type === 'text' || type === 'number') {
    return <ConditionPanel {...props} type={type} />
  }
  return null
}
