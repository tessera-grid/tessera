/**
 * Панель фильтра даты (ADR 0047, §5): условие, пресеты, календарь `@daypicker/react`
 * в поясе `timeZone`, поле времени у `datetime`. Выбор дня, диапазона, пресета и
 * условия применяется сразу, ввод времени — через `debounceMs`. Модуль ленивый.
 */
import { type ComponentProps, useEffect, useId, useRef, useState } from 'react'

import {
  type DateRange,
  DayPicker,
  type DayPickerLocale,
  TZDate,
} from '@daypicker/react'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { ChevronDown } from 'lucide-react'

import { setColumnFilterByUser } from '../../core/filtering'
import { useLocalization } from '../../core/localization'
import { useDebouncedCallback } from '../../core/useDebouncedCallback'
import { useIcons } from '../../ui/icons'
import { operatorLabel, PRESET_LABEL } from './describeFilter'
import type { FilterPanelProps } from './FilterPanel'
import { OperatorSelect } from './OperatorSelect'
import type {
  ColumnFilterValue,
  DateFilter,
  DateFilterOperator,
  DateFilterPreset,
} from './types'

import panelStyles from './FilterPanel.module.css'
import styles from './DateFilterPanel.module.css'

const OPERATORS: DateFilterOperator[] = [
  'on',
  'before',
  'after',
  'between',
  'preset',
  'empty',
  'notEmpty',
]

const PRESETS: DateFilterPreset[] = [
  'today',
  'yesterday',
  'last7Days',
  'last30Days',
  'thisMonth',
  'thisYear',
]

// Годы в выпадающем списке календаря.
const START_MONTH = new Date(1900, 0, 1)
const END_MONTH = new Date(2100, 11, 31)

interface Draft {
  operator: DateFilterOperator
  /** Дни — `'YYYY-MM-DD'`, время — `'HH:mm'` или `''`. */
  day: string | null
  time: string
  from: string | null
  fromTime: string
  to: string | null
  toTime: string
  preset: DateFilterPreset | null
}

const EMPTY_DRAFT: Draft = {
  operator: 'on',
  day: null,
  time: '',
  from: null,
  fromTime: '',
  to: null,
  toTime: '',
  preset: null,
}

const splitValue = (value: string | null | undefined) => {
  if (!value) return { day: null, time: '' }
  const [day, time = ''] = value.split('T')
  return { day, time: time.slice(0, 5) }
}

const draftOf = (current: DateFilter | undefined): Draft => {
  if (!current) return EMPTY_DRAFT
  const draft = { ...EMPTY_DRAFT, operator: current.operator }
  if (current.operator === 'preset') return { ...draft, preset: current.value }
  if (current.operator === 'between') {
    const from = splitValue(current.value[0])
    const to = splitValue(current.value[1])
    return {
      ...draft,
      from: from.day,
      fromTime: from.time,
      to: to.day,
      toTime: to.time,
    }
  }
  if ('value' in current) {
    const { day, time } = splitValue(current.value)
    return { ...draft, day, time }
  }
  return draft
}

const withTime = (day: string, time: string, timed: boolean) =>
  timed && time ? `${day}T${time}` : day

const filterOf = (
  draft: Draft,
  timed: boolean,
): ColumnFilterValue | undefined => {
  switch (draft.operator) {
    case 'empty':
    case 'notEmpty':
      return { operator: draft.operator }
    case 'preset':
      return draft.preset
        ? { operator: 'preset', value: draft.preset }
        : undefined
    case 'on':
      return draft.day ? { operator: 'on', value: draft.day } : undefined
    case 'before':
    case 'after':
      return draft.day
        ? {
            operator: draft.operator,
            value: withTime(draft.day, draft.time, timed),
          }
        : undefined
    case 'between':
      return draft.from || draft.to
        ? {
            operator: 'between',
            value: [
              draft.from && withTime(draft.from, draft.fromTime, timed),
              draft.to && withTime(draft.to, draft.toTime, timed),
            ],
          }
        : undefined
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** День календаря (в поясе календаря) → `'YYYY-MM-DD'`. */
const dayOfDate = (date: Date | undefined) =>
  date
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : null

/** `'YYYY-MM-DD'` → полночь этого дня в поясе календаря. */
const dateOfDay = (day: string | null, timeZone?: string) => {
  if (!day) return undefined
  const [year, month, date] = day.split('-').map(Number)
  return timeZone
    ? new TZDate(year, month - 1, date, timeZone)
    : new Date(year, month - 1, date)
}

type ChevronProps = ComponentProps<
  NonNullable<ComponentProps<typeof DayPicker>['components']>['Chevron'] &
    object
>

const CalendarChevron = ({ orientation }: ChevronProps) => {
  const { previousMonth: Previous, nextMonth: Next } = useIcons()
  if (orientation === 'left') return <Previous width={16} height={16} />
  if (orientation === 'right') return <Next width={16} height={16} />
  return <ChevronDown width={14} height={14} aria-hidden />
}

const CLASS_NAMES = {
  root: styles.calendar,
  months: styles.months,
  month: styles.month,
  nav: styles.nav,
  button_previous: styles.navButton,
  button_next: styles.navButton,
  month_caption: styles.caption,
  caption_label: styles.captionLabel,
  dropdowns: styles.dropdowns,
  dropdown_root: styles.dropdownRoot,
  dropdown: styles.dropdown,
  chevron: styles.chevron,
  month_grid: styles.grid,
  weekdays: styles.weekdays,
  weekday: styles.weekday,
  week: styles.week,
  day: styles.day,
  day_button: styles.dayButton,
  today: styles.today,
  selected: styles.selected,
  range_start: styles.rangeStart,
  range_middle: styles.rangeMiddle,
  range_end: styles.rangeEnd,
  outside: styles.outside,
  disabled: styles.disabled,
  hidden: styles.hidden,
  focused: styles.focused,
}

const needsCalendar = (operator: DateFilterOperator) =>
  operator === 'on' ||
  operator === 'before' ||
  operator === 'after' ||
  operator === 'between'

/** Смена условия переносит выбранный день: день ↔ диапазон из одного дня. */
const switchOperator = (
  draft: Draft,
  operator: DateFilterOperator,
): Partial<Draft> => {
  if (operator === 'between' && draft.operator !== 'between' && draft.day) {
    return { operator, from: draft.day, to: draft.day }
  }
  if (draft.operator === 'between' && needsCalendar(operator) && draft.from) {
    return { operator, day: draft.from }
  }
  return { operator }
}

interface DateFilterOptions {
  columnFilteringTimeZone?: string
  columnFilteringDateLocale?: DayPickerLocale
}

export const DateFilterPanel = ({
  table,
  column,
  debounceMs,
  type,
}: FilterPanelProps & { type: 'date' | 'datetime' }) => {
  const labels = useLocalization()
  const presetsId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const options = (table as { options: DateFilterOptions }).options
  const timeZone = options.columnFilteringTimeZone
  const locale = options.columnFilteringDateLocale
  const timed = type === 'datetime'
  const [draft, setDraft] = useState(() =>
    draftOf(column.getFilterValue() as DateFilter | undefined),
  )

  const apply = useDebouncedCallback((next: Draft) => {
    setColumnFilterByUser(table, column.id, filterOf(next, timed))
  }, debounceMs)

  const update = (patch: Partial<Draft>, immediate = true) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    apply.schedule(next)
    if (immediate) apply.flush()
  }

  const reset = () => {
    apply.cancel()
    setColumnFilterByUser(table, column.id, undefined)
    setDraft(EMPTY_DRAFT)
  }

  // Модуль ленивый: к открытию поповера панели ещё нет, фокус ставится после загрузки.
  useEffect(() => {
    const root = rootRef.current
    if (!root || root.contains(document.activeElement)) return
    const target =
      root.querySelector<HTMLElement>('[role="grid"] button[tabindex="0"]') ??
      root.querySelector<HTMLElement>('[data-testid="filter-operator"]')
    target?.focus()
  }, [])

  const calendarProps = {
    captionLayout: 'dropdown' as const,
    startMonth: START_MONTH,
    endMonth: END_MONTH,
    timeZone,
    locale,
    classNames: CLASS_NAMES,
    components: { Chevron: CalendarChevron },
    labels: {
      labelPrevious: () => labels.previousMonth,
      labelNext: () => labels.nextMonth,
    },
    'data-testid': 'filter-calendar',
  }

  const timeField = (
    key: 'time' | 'fromTime' | 'toTime',
    label: string,
    testId: string,
  ) => (
    <input
      className={panelStyles.input}
      type="time"
      aria-label={label}
      value={draft[key]}
      onChange={event => update({ [key]: event.target.value }, false)}
      data-testid={testId}
    />
  )

  return (
    <div
      ref={rootRef}
      className={panelStyles.panel}
      data-testid="filter-panel"
      data-filter-type={type}
    >
      <OperatorSelect
        value={draft.operator}
        operators={OPERATORS}
        labelOf={operator => operatorLabel(operator, labels)}
        onChange={operator => update(switchOperator(draft, operator))}
      />
      {draft.operator === 'preset' && (
        <>
          <span id={presetsId} hidden>
            {labels.filterPreset}
          </span>
          <RadioGroup
            value={draft.preset ?? ''}
            onValueChange={value =>
              update({ preset: value as DateFilterPreset })
            }
            aria-labelledby={presetsId}
            className={panelStyles.options}
            data-testid="filter-presets"
          >
            {PRESETS.map(preset => (
              <label key={preset} className={panelStyles.option}>
                <Radio.Root
                  value={preset}
                  className={panelStyles.radio}
                  data-value={preset}
                >
                  <Radio.Indicator className={panelStyles.dot} />
                </Radio.Root>
                <span>{labels[PRESET_LABEL[preset]] as string}</span>
              </label>
            ))}
          </RadioGroup>
        </>
      )}
      {draft.operator === 'between' ? (
        <DayPicker
          {...calendarProps}
          mode="range"
          defaultMonth={dateOfDay(draft.from ?? draft.to, timeZone)}
          selected={{
            from: dateOfDay(draft.from, timeZone),
            to: dateOfDay(draft.to, timeZone),
          }}
          onSelect={(range: DateRange | undefined) =>
            update({
              from: dayOfDate(range?.from),
              to: dayOfDate(range?.to),
            })
          }
        />
      ) : (
        needsCalendar(draft.operator) && (
          <DayPicker
            {...calendarProps}
            mode="single"
            defaultMonth={dateOfDay(draft.day, timeZone)}
            selected={dateOfDay(draft.day, timeZone)}
            onSelect={(date: Date | undefined) =>
              update({ day: dayOfDate(date) })
            }
          />
        )
      )}
      {timed &&
        (draft.operator === 'before' || draft.operator === 'after') &&
        timeField('time', labels.filterTime, 'filter-time')}
      {timed && draft.operator === 'between' && (
        <div className={panelStyles.range}>
          {timeField('fromTime', labels.filterTimeFrom, 'filter-time-from')}
          {timeField('toTime', labels.filterTimeTo, 'filter-time-to')}
        </div>
      )}
      <div className={panelStyles.footer}>
        <button
          type="button"
          className={panelStyles.reset}
          onClick={reset}
          data-testid="filter-reset"
        >
          {labels.filterReset}
        </button>
      </div>
    </div>
  )
}
