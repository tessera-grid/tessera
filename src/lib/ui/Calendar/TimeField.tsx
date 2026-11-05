/**
 * Поле времени кита (ADR 0183, PK20): часы и минуты сегментами в рамке поля, формат 12 или 24
 * часа и подпись половины суток — из языка таблицы. Сегмент — `spinbutton`: стрелки меняют
 * значение (минуты — с шагом `step`), цифры вводятся с клавиатуры, `Backspace` очищает. Кнопка
 * часов справа открывает поповер кита с колонками часов, минут и половины суток. Значение —
 * `'HH:mm'` или пустая строка.
 */
import type { KeyboardEvent, MouseEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'

import { IconButton } from '../IconButton'
import { useIcons } from '../icons'
import { PopupItem, PopupItemMark } from '../Popup/PopupItem'
import { PopupSurface } from '../Popup/PopupSurface'

import fieldStyles from '../Field/Field.module.css'
import styles from './TimeField.module.css'

/** Подписи сегментов и кнопки списка — от владельца словаря. */
export interface TimeFieldLabels {
  hours: string
  minutes: string
  dayPeriod: string
  chooseTime: string
}

export interface TimeFieldProps {
  /** `'HH:mm'` или пустая строка. */
  value: string
  onChange: (value: string) => void
  /** Имя поля целиком. */
  label: string
  labels: TimeFieldLabels
  /** Язык таблицы: формат часов и подпись половины суток. */
  locale?: string
  /** Шаг минут у стрелок и в списке. */
  step?: number
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  testId: string
}

type Segment = 'hours' | 'minutes' | 'period'

interface Time {
  hours: number | null
  minutes: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')

const parse = (value: string): Time => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return { hours: null, minutes: null }
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

const format = ({ hours, minutes }: Time) =>
  hours === null || minutes === null ? '' : `${pad(hours)}:${pad(minutes)}`

/** Формат часов и подписи половины суток языка. */
const clockOf = (locale?: string) => {
  const cycle = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
  }).resolvedOptions().hourCycle
  const twelve = cycle === 'h11' || cycle === 'h12'
  const periodOf = (hour: number) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true })
      .formatToParts(new Date(2000, 0, 1, hour))
      .find(part => part.type === 'dayPeriod')?.value ??
    (hour < 12 ? 'AM' : 'PM')
  return { twelve, am: periodOf(1), pm: periodOf(13) }
}

const wrap = (value: number, size: number) => ((value % size) + size) % size

/** Колонка списка открывается на выбранном: он посередине, а не за краем. */
const centerSelected = (column: HTMLDivElement | null) => {
  const selected = column?.querySelector<HTMLElement>('[aria-pressed="true"]')
  if (!column || !selected) return
  column.scrollTop =
    selected.offsetTop -
    column.offsetTop -
    (column.clientHeight - selected.offsetHeight) / 2
}

export const TimeField = ({
  value,
  onChange,
  label,
  labels,
  locale,
  step = 1,
  onKeyDown,
  testId,
}: TimeFieldProps) => {
  const { chooseTime: ClockIcon } = useIcons()
  const clock = useMemo(() => clockOf(locale), [locale])
  // Черновик сегментов: незаполненный сегмент — пустое значение поля.
  const [draft, setDraft] = useState<Time>(() => parse(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== format(draft)) setDraft(parse(value))
  }
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const typed = useRef('')
  const refs = {
    hours: useRef<HTMLSpanElement>(null),
    minutes: useRef<HTMLSpanElement>(null),
    period: useRef<HTMLSpanElement>(null),
  }
  const order: Segment[] = clock.twelve
    ? ['hours', 'minutes', 'period']
    : ['hours', 'minutes']

  // Записанное, но ещё не отрисованное время: нажатия подряд без отрисовки между ними (быстрый
  // набор) читают его, а не время отрисовки — иначе следующее нажатие затёрло бы предыдущее.
  const pending = useRef<Time | null>(null)
  useEffect(() => {
    pending.current = null
  })
  const current = () => pending.current ?? draft
  const isPm = () => {
    const { hours } = current()
    return hours !== null && hours >= 12
  }

  const commit = (next: Time) => {
    const before = format(current())
    pending.current = next
    setDraft(next)
    const text = format(next)
    if (text !== before) onChange(text)
  }
  const focus = (segment: Segment | undefined) => {
    typed.current = ''
    if (segment) refs[segment].current?.focus()
  }
  const move = (segment: Segment, by: 1 | -1) =>
    focus(order[order.indexOf(segment) + by])

  const setHours = (hours: number | null) => commit({ ...current(), hours })
  const setMinutes = (minutes: number | null) =>
    commit({ ...current(), minutes })

  /** Часы на циферблате: 1–12 у 12-часового формата. */
  const shownHours = (hours: number) =>
    clock.twelve ? (hours % 12 === 0 ? 12 : hours % 12) : hours
  const pm = draft.hours !== null && draft.hours >= 12

  const typeDigit = (segment: Segment, digit: number) => {
    const text = typed.current + String(digit)
    if (segment === 'hours') {
      const max = clock.twelve ? 12 : 23
      const number = Number(text)
      const hours12 = (n: number) => (n % 12) + (isPm() ? 12 : 0)
      const hours = clock.twelve ? hours12(number === 0 ? 12 : number) : number
      if (number > max) return
      setHours(hours)
      // Вторую цифру уже не вписать — к минутам.
      if (text.length === 2 || number * 10 > max) move(segment, 1)
      else typed.current = text
    } else if (segment === 'minutes') {
      const number = Number(text)
      if (number > 59) return
      setMinutes(number)
      if (text.length === 2 || number * 10 > 59) {
        if (clock.twelve) move(segment, 1)
        else typed.current = ''
      } else typed.current = text
    }
  }

  /**
   * Нажатие по рамке поля мимо сегментов и кнопки — фокус на сегмент, как у поля ввода: у
   * незаполненного поля — на первый пустой, иначе — на ближайший к точке нажатия.
   */
  const focusFromField = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-segment], button')) return
    event.preventDefault()
    const now = current()
    const empty = order.find(name =>
      name === 'minutes' ? now.minutes === null : now.hours === null,
    )
    const nearest = order
      .map(name => {
        const rect = refs[name].current?.getBoundingClientRect()
        const middle = rect ? rect.left + rect.width / 2 : Infinity
        return { name, distance: Math.abs(event.clientX - middle) }
      })
      .sort((a, b) => a.distance - b.distance)[0]?.name
    focus(empty ?? nearest)
  }

  const keyDown = (segment: Segment) => (event: KeyboardEvent<HTMLElement>) => {
    const key = event.key
    const now = current()
    const step1 = key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0
    if (step1 !== 0) {
      event.preventDefault()
      typed.current = ''
      if (segment === 'hours')
        setHours(now.hours === null ? 0 : wrap(now.hours + step1, 24))
      else if (segment === 'minutes') {
        const base = now.minutes === null ? 0 : now.minutes
        const snapped = Math.round(base / step) * step
        setMinutes(now.minutes === null ? 0 : wrap(snapped + step1 * step, 60))
      } else if (now.hours !== null) setHours(wrap(now.hours + 12, 24))
      return
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault()
      move(segment, key === 'ArrowRight' ? 1 : -1)
      return
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault()
      typed.current = ''
      if (segment === 'hours') setHours(null)
      else if (segment === 'minutes') setMinutes(null)
      return
    }
    if (/^\d$/.test(key) && segment !== 'period') {
      event.preventDefault()
      typeDigit(segment, Number(key))
      return
    }
    if (segment === 'period' && now.hours !== null) {
      const lower = key.toLowerCase()
      if (lower === clock.am[0]?.toLowerCase() && isPm()) {
        event.preventDefault()
        setHours(now.hours - 12)
      } else if (lower === clock.pm[0]?.toLowerCase() && !isPm()) {
        event.preventDefault()
        setHours(now.hours + 12)
      }
    }
  }

  const segment = (
    name: Segment,
    text: string,
    now: number | undefined,
    min: number,
    max: number,
    name18n: string,
  ) => (
    <span
      ref={refs[name]}
      role="spinbutton"
      tabIndex={0}
      aria-label={name18n}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={now === undefined ? undefined : text}
      data-segment={name}
      data-empty={now === undefined || undefined}
      className={styles.segment}
      onKeyDown={keyDown(name)}
      onBlur={() => (typed.current = '')}
    >
      {text}
    </span>
  )

  const hourOptions = clock.twelve
    ? [12, ...Array.from({ length: 11 }, (_, i) => i + 1)]
    : Array.from({ length: 24 }, (_, i) => i)
  const minuteOptions = Array.from(
    { length: Math.ceil(60 / step) },
    (_, i) => i * step,
  )

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      data-value={format(draft)}
      className={clsx(fieldStyles.field, styles.field)}
      onKeyDown={onKeyDown}
      onMouseDown={focusFromField}
    >
      <span className={styles.segments}>
        {segment(
          'hours',
          draft.hours === null ? '--' : pad(shownHours(draft.hours)),
          draft.hours === null ? undefined : shownHours(draft.hours),
          clock.twelve ? 1 : 0,
          clock.twelve ? 12 : 23,
          labels.hours,
        )}
        <span aria-hidden>:</span>
        {segment(
          'minutes',
          draft.minutes === null ? '--' : pad(draft.minutes),
          draft.minutes ?? undefined,
          0,
          59,
          labels.minutes,
        )}
        {clock.twelve &&
          segment(
            'period',
            draft.hours === null ? '--' : pm ? clock.pm : clock.am,
            draft.hours === null ? undefined : pm ? 1 : 0,
            0,
            1,
            labels.dayPeriod,
          )}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <IconButton
          shape="square"
          size="compact"
          label={labels.chooseTime}
          className={styles.open}
          render={<Popover.Trigger />}
        >
          <ClockIcon />
        </IconButton>
        <Popover.Portal>
          <PopupSurface
            positioner={<Popover.Positioner side="bottom" align="end" />}
            popup={
              <Popover.Popup
                ref={listRef}
                aria-label={labels.chooseTime}
                // Фокус — на выбранном часе: колонка не прокручивается обратно к первому.
                initialFocus={() =>
                  listRef.current?.querySelector<HTMLElement>(
                    '[aria-pressed="true"]',
                  ) ?? true
                }
              />
            }
          >
            <div className={styles.columns}>
              <div
                ref={centerSelected}
                className={styles.column}
                aria-label={labels.hours}
              >
                {hourOptions.map(hour => {
                  const hours = clock.twelve
                    ? (hour % 12) + (pm ? 12 : 0)
                    : hour
                  const selected = draft.hours === hours
                  return (
                    <PopupItem
                      key={hour}
                      render={<button type="button" />}
                      className={styles.option}
                      aria-pressed={selected}
                      label={pad(hour)}
                      end={selected ? <PopupItemMark status="checked" /> : null}
                      onClick={() => setHours(hours)}
                    />
                  )
                })}
              </div>
              <div
                ref={centerSelected}
                className={styles.column}
                aria-label={labels.minutes}
              >
                {minuteOptions.map(minutes => {
                  const selected = draft.minutes === minutes
                  return (
                    <PopupItem
                      key={minutes}
                      render={<button type="button" />}
                      className={styles.option}
                      aria-pressed={selected}
                      label={pad(minutes)}
                      end={selected ? <PopupItemMark status="checked" /> : null}
                      onClick={() => {
                        setMinutes(minutes)
                        setOpen(false)
                      }}
                    />
                  )
                })}
              </div>
              {clock.twelve && (
                <div
                  ref={centerSelected}
                  className={styles.column}
                  aria-label={labels.dayPeriod}
                >
                  {[clock.am, clock.pm].map((period, index) => {
                    const selected =
                      draft.hours !== null && pm === (index === 1)
                    return (
                      <PopupItem
                        key={period}
                        render={<button type="button" />}
                        className={styles.option}
                        aria-pressed={selected}
                        label={period}
                        end={
                          selected ? <PopupItemMark status="checked" /> : null
                        }
                        onClick={() =>
                          setHours(
                            ((current().hours ?? 0) % 12) +
                              (index === 1 ? 12 : 0),
                          )
                        }
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </PopupSurface>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
