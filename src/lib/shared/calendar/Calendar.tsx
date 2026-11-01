/**
 * Календарь дат (ADR 0047, ADR 0175): `@daypicker/react` в поясе и на языке таблицы, стрелки
 * из `icons`, подписи из `localization`. Его берут фильтр даты и редактор даты; оба грузят
 * его своим ленивым модулем.
 */
import type { ComponentProps, KeyboardEvent } from 'react'

import {
  type DateRange,
  DayPicker,
  type DayPickerLocale,
  labelDayButton,
  TZDate,
} from '@daypicker/react'
import { ChevronDown } from 'lucide-react'

import { useLocalization } from '../../core/localization'
import { useIcons } from '../../ui/icons'

import styles from './Calendar.module.css'

export type { DateRange }

// Годы в выпадающем списке календаря.
const START_MONTH = new Date(1900, 0, 1)
const END_MONTH = new Date(2100, 11, 31)

const pad = (n: number) => String(n).padStart(2, '0')

/** День календаря (в поясе календаря) → `'YYYY-MM-DD'`. */
export const dayOfDate = (date: Date | undefined) =>
  date
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : null

/** `'YYYY-MM-DD'` → полночь этого дня в поясе календаря. */
export const dateOfDay = (day: string | null, timeZone?: string) => {
  if (!day) return undefined
  const [year, month, date] = day.split('-').map(Number)
  return timeZone
    ? new TZDate(year!, month! - 1, date!, timeZone)
    : new Date(year!, month! - 1, date!)
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

interface CalendarBase {
  timeZone?: string
  locale?: DayPickerLocale
  testId: string
}

export type CalendarProps = CalendarBase &
  (
    | {
        mode: 'single'
        /** Выбранный день не снимается повторным нажатием. */
        required?: boolean
        /** День — `'YYYY-MM-DD'`. */
        day: string | null
        onDay: (day: string | null) => void
      }
    | {
        mode: 'range'
        from: string | null
        to: string | null
        onRange: (from: string | null, to: string | null) => void
      }
  )

export const Calendar = (props: CalendarProps) => {
  const labels = useLocalization()
  const { timeZone } = props
  const common = {
    captionLayout: 'dropdown' as const,
    startMonth: START_MONTH,
    endMonth: END_MONTH,
    timeZone,
    locale: props.locale,
    classNames: CLASS_NAMES,
    components: { Chevron: CalendarChevron },
    labels: {
      labelPrevious: () => labels.previousMonth,
      labelNext: () => labels.nextMonth,
      // Имя дня начинается с видимого числа (WCAG 2.5.3), дальше — полная дата.
      labelDayButton: (...args: Parameters<typeof labelDayButton>) =>
        `${args[3]?.format(args[0], 'd') ?? args[0].getDate()}, ${labelDayButton(...args)}`,
    },
    'data-testid': props.testId,
  }
  if (props.mode === 'range')
    return (
      <DayPicker
        {...common}
        mode="range"
        defaultMonth={dateOfDay(props.from ?? props.to, timeZone)}
        selected={{
          from: dateOfDay(props.from, timeZone),
          to: dateOfDay(props.to, timeZone),
        }}
        onSelect={(range: DateRange | undefined) =>
          props.onRange(dayOfDate(range?.from), dayOfDate(range?.to))
        }
      />
    )
  return (
    <DayPicker
      {...common}
      mode="single"
      required={props.required}
      defaultMonth={dateOfDay(props.day, timeZone)}
      selected={dateOfDay(props.day, timeZone)}
      onSelect={(date: Date | undefined) => props.onDay(dayOfDate(date))}
    />
  )
}

/** Поле времени `'HH:mm'` рядом с календарём. */
export const TimeField = ({
  value,
  label,
  onChange,
  onKeyDown,
  className = styles.time,
  testId,
}: {
  value: string
  label: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  className?: string
  testId: string
}) => (
  <input
    className={className}
    type="time"
    aria-label={label}
    value={value}
    onChange={event => onChange(event.target.value)}
    onKeyDown={onKeyDown}
    data-testid={testId}
  />
)
