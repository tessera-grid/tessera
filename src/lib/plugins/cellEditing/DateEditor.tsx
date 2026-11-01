/**
 * Редактор даты (ADR 0175, ED6): поповер с общим календарём в поясе и на языке таблицы, у
 * даты со временем — поле времени. Выбор дня у даты без времени сохраняет сразу; Enter в
 * поле времени и уход из поповера сохраняют, Escape отменяет; фокус возвращается в ячейку.
 * Модуль ленивый — грузится при первой правке даты (ED7).
 */
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { Popover } from '@base-ui/react/popover'
import { TZDate } from '@daypicker/react'
import clsx from 'clsx'

import { commonOptionsOf } from '../../core/commonFeature'
import { dateTypeInstant } from '../../core/dataTypeFormat'
import { restoreFocusIfLost } from '../../core/keyboardNavigation/actions'
import { useLocalization } from '../../core/localization'
import { cellToWallValue, WALL_TIME } from '../../core/wallTime'
import { Calendar, TimeField } from '../../shared/calendar/Calendar'
import { usePortalThemeClass, usePortalThemeData } from '../../ui/theme'
import { POPUP_SIDE_OFFSET } from '../../ui/Popup/offset'
import type { CellEditorProps } from './types'

import styles from './DateEditor.module.css'

interface Wall {
  /** `'YYYY-MM-DD'` или `null` — пусто. */
  day: string | null
  /** `'HH:mm'`. */
  time: string
}

/** Значение ячейки → день и время на часах пояса таблицы. */
const wallOf = (props: CellEditorProps, timeZone: string | undefined): Wall => {
  const type = props.cell.column.getDataType()
  const ms = dateTypeInstant(type, props.value)
  const wall =
    typeof props.value === 'string' && !type?.definition.parseDate
      ? cellToWallValue(props.value, timeZone)
      : ms === undefined
        ? null
        : cellToWallValue(ms, timeZone)
  if (!wall) return { day: null, time: '' }
  const iso = new Date(wall.ms).toISOString()
  return { day: iso.slice(0, 10), time: wall.dateOnly ? '' : iso.slice(11, 16) }
}

/** Момент дня и времени на часах пояса таблицы. */
const instantOf = (day: string, time: string, timeZone: string | undefined) => {
  const [year, month, date] = day.split('-').map(Number)
  const [hour, minute] = (time || '00:00').split(':').map(Number)
  return timeZone
    ? new Date(
        new TZDate(
          year!,
          month! - 1,
          date!,
          hour!,
          minute!,
          timeZone,
        ).getTime(),
      )
    : new Date(year!, month! - 1, date!, hour!, minute!)
}

/**
 * Значение в типе колонки: `dateString` — день, `dateTimeString` — стенное время, если оно
 * было без смещения, иначе ISO-момент; `date` и `dateTime` — `Date`.
 */
const valueOf = (
  base: string,
  wall: Wall,
  original: unknown,
  timeZone: string | undefined,
): unknown => {
  if (!wall.day) return null
  switch (base) {
    case 'dateString':
      return wall.day
    case 'dateTimeString':
      return typeof original === 'string' && WALL_TIME.test(original.trim())
        ? `${wall.day}T${wall.time || '00:00'}`
        : instantOf(wall.day, wall.time, timeZone).toISOString()
    default:
      return instantOf(wall.day, wall.time, timeZone)
  }
}

export const DateEditor = (props: CellEditorProps) => {
  const { cell, label, commit, cancel, setDraft, text } = props
  const labels = useLocalization()
  const themeClass = usePortalThemeClass()
  const themeData = usePortalThemeData()
  const { timeZone, dateLocale } = commonOptionsOf(cell.table)
  const base = cell.column.getDataType()?.base ?? 'date'
  const timed = base === 'dateTime' || base === 'dateTimeString'
  const anchor = useRef<HTMLSpanElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [wall, setWall] = useState(() => wallOf(props, timeZone))
  const original = cell.getValue()

  // Правка закрылась — фокус в ячейку, если он пропал вместе с поповером.
  useEffect(() => {
    const element = anchor.current?.closest<HTMLElement>(
      '.data-grid__body-cell',
    )
    return () => {
      if (element) restoreFocusIfLost(element)
    }
  }, [])

  const save = (next = wall) => commit(valueOf(base, next, original, timeZone))
  const change = (next: Wall) => {
    setWall(next)
    setDraft(valueOf(base, next, original, timeZone))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Клавиши поповера — его, а не навигации грида.
    event.stopPropagation()
    if (event.key === 'Escape') cancel()
  }

  return (
    <span ref={anchor} className={styles.anchor}>
      {text}
      <Popover.Root
        open
        modal={false}
        onOpenChange={(open, details) => {
          if (open) return
          if (details.reason === 'escape-key') cancel()
          else save()
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchor}
            side="bottom"
            align="start"
            sideOffset={POPUP_SIDE_OFFSET}
            className={clsx(themeClass, styles.positioner)}
            {...themeData}
          >
            <Popover.Popup
              ref={popup}
              aria-label={label}
              initialFocus={() =>
                popup.current?.querySelector<HTMLElement>(
                  '[role="grid"] button[tabindex="0"]',
                ) ?? true
              }
              finalFocus={false}
              className={clsx(themeClass, styles.popup)}
              data-testid="edit-date"
              onKeyDown={onKeyDown}
            >
              <Calendar
                mode="single"
                required
                day={wall.day}
                timeZone={timeZone}
                locale={dateLocale}
                testId="edit-calendar"
                onDay={day => {
                  const next = { ...wall, day }
                  if (timed) change(next)
                  else save(next)
                }}
              />
              {timed && (
                <TimeField
                  label={labels.filterTime}
                  value={wall.time}
                  testId="edit-time"
                  onChange={time => change({ ...wall, time })}
                  onKeyDown={event => {
                    if (event.key === 'Enter') save()
                  }}
                />
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  )
}
