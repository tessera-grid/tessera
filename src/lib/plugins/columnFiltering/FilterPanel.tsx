/**
 * Панель фильтра колонки (ADR 0045, §3–§4): условие, значение, «Сбросить».
 * Ввод применяется через `debounceMs` после последнего нажатия, выбор условия и
 * булева значения — сразу. Нечисловой ввод в поле числа не применяется.
 */
import { type RefObject, useId, useState } from 'react'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Select } from '@base-ui/react/select'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'

import { setColumnFilterByUser } from '../../core/filtering'
import type { ActionPanelControls } from '../../core/headerActions'
import { useLocalization } from '../../core/localization'
import { usePortalThemeClass } from '../../core/themeVariables'
import { useDebouncedCallback } from '../../core/useDebouncedCallback'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import { filterTypeOf } from './conditions'
import { type FilterOperator, operatorLabel } from './describeFilter'
import type {
  ColumnFilterDef,
  ColumnFilterValue,
  NumberFilterOperator,
  TextFilterOperator,
} from './types'

import styles from './FilterPanel.module.css'

interface FilterColumn {
  id: string
  columnDef: { filter?: ColumnFilterDef }
  getFilterValue: () => unknown
}

interface FilterPanelProps {
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

/** Число из ввода: `null` — пусто, `NaN` — не число; запятая — десятичный знак. */
export const parseNumberInput = (input: string): number | null => {
  const text = input.trim().replace(',', '.')
  if (text === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : Number.NaN
}

const isInvalidNumber = (input: string) =>
  Number.isNaN(parseNumberInput(input) as number)

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
): ColumnFilterValue | undefined | null => {
  const { operator } = draft
  if (!needsValue(operator)) {
    return { operator } as ColumnFilterValue
  }
  if (type === 'text') {
    return { operator, value: draft.value } as ColumnFilterValue
  }
  if (operator === 'between') {
    const from = parseNumberInput(draft.from)
    const to = parseNumberInput(draft.to)
    if (Number.isNaN(from) || Number.isNaN(to)) return null
    if (from === null && to === null) return undefined
    return { operator, value: [from, to] }
  }
  const value = parseNumberInput(draft.value)
  if (Number.isNaN(value)) return null
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
  const themeClass = usePortalThemeClass()
  const errorId = useId()
  const [draft, setDraft] = useState(() =>
    draftOf(type, column.getFilterValue() as ColumnFilterValue | undefined),
  )
  const apply = useDebouncedCallback((next: Draft) => {
    const filter = filterOf(type, next)
    if (filter !== null) setColumnFilterByUser(table, column.id, filter)
  }, debounceMs)

  const update = (patch: Partial<Draft>, immediate = false) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    apply.schedule(next)
    if (immediate) apply.flush()
  }

  const reset = () => {
    apply.cancel()
    setColumnFilterByUser(table, column.id, undefined)
    setDraft(draftOf(type, undefined))
  }

  const operators = type === 'text' ? TEXT_OPERATORS : NUMBER_OPERATORS
  const labelOf = (operator: Operator) => operatorLabel(operator, labels)

  const numberField = (
    key: 'value' | 'from' | 'to',
    label: string,
    focusRef?: RefObject<HTMLElement | null>,
  ) => {
    const invalid = type === 'number' && isInvalidNumber(draft[key])
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
        data-testid={`filter-${key}`}
      />
    )
  }

  const invalid =
    type === 'number' &&
    (draft.operator === 'between'
      ? isInvalidNumber(draft.from) || isInvalidNumber(draft.to)
      : needsValue(draft.operator) && isInvalidNumber(draft.value))

  return (
    <div className={styles.panel} data-testid="filter-panel">
      <Select.Root
        value={draft.operator}
        onValueChange={value => {
          if (value !== null) update({ operator: value }, true)
        }}
      >
        <Select.Trigger
          className={styles.trigger}
          aria-label={labels.filterCondition}
          data-testid="filter-operator"
        >
          <Select.Value>{labelOf(draft.operator)}</Select.Value>
          <Select.Icon className={styles.triggerIcon}>
            <ChevronDown width={14} height={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            side="bottom"
            align="start"
            sideOffset={POPUP_SIDE_OFFSET}
            alignItemWithTrigger={false}
            className={clsx(themeClass, styles.selectPositioner)}
          >
            <Select.Popup className={clsx(themeClass, styles.selectPopup)}>
              <Select.List>
                {operators.map(operator => (
                  <Select.Item
                    key={operator}
                    value={operator}
                    className={styles.selectItem}
                    data-operator={operator}
                  >
                    <Select.ItemText>{labelOf(operator)}</Select.ItemText>
                    <Select.ItemIndicator className={styles.itemCheck}>
                      <Check width={14} height={14} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      {draft.operator === 'between' ? (
        <div className={styles.range}>
          {numberField('from', labels.filterFrom, controls.initialFocusRef)}
          {numberField('to', labels.filterTo)}
        </div>
      ) : (
        needsValue(draft.operator) &&
        numberField('value', labels.filterValue, controls.initialFocusRef)
      )}
      {invalid && (
        <span id={errorId} className={styles.error} role="alert">
          {labels.filterInvalidNumber}
        </span>
      )}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.reset}
          onClick={reset}
          data-testid="filter-reset"
        >
          {labels.filterReset}
        </button>
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
  const def = column.columnDef.filter
  const nullable = typeof def === 'object' && !!def.nullable
  const choice = choiceOf(
    column.getFilterValue() as ColumnFilterValue | undefined,
  )
  const [value, setValue] = useState(choice)
  const choices: [BooleanChoice, string][] = [
    ['all', labels.filterAll],
    ['yes', labels.filterYes],
    ['no', labels.filterNo],
    ...(nullable
      ? [['empty', labels.filterEmpty] as [BooleanChoice, string]]
      : []),
  ]

  return (
    <div className={styles.panel} data-testid="filter-panel">
      <span id={labelId} hidden>
        {labels.filterValue}
      </span>
      <RadioGroup
        value={value}
        onValueChange={next => {
          const nextChoice = next as BooleanChoice
          setValue(nextChoice)
          setColumnFilterByUser(table, column.id, filterOfChoice(nextChoice))
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
    </div>
  )
}

export const FilterPanel = (props: FilterPanelProps) => {
  const type = filterTypeOf(props.column.columnDef.filter)
  if (type === 'boolean') return <BooleanPanel {...props} />
  if (type === 'text' || type === 'number') {
    return <ConditionPanel {...props} type={type} />
  }
  return null
}
