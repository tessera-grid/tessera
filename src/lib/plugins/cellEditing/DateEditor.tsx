/**
 * Редактор даты (ADR 0175, ED6): поповер с общим календарём в поясе и на языке таблицы, у
 * даты со временем — поле времени. Выбор дня у даты без времени сохраняет сразу; Enter в
 * поле времени и уход из поповера сохраняют, Escape отменяет; фокус возвращается в ячейку.
 * Модуль ленивый — грузится при первой правке даты (ED7).
 */
import { useState } from 'react'

import { TZDate } from '@daypicker/react'

import { commonOptionsOf } from '../../core/commonFeature'
import { dateTypeInstant } from '../../core/dataTypeFormat'
import { useLocalization } from '../../core/localization'
import { cellToWallValue, WALL_TIME } from '../../core/wallTime'
import { Calendar, TimeField } from '../../shared/calendar/Calendar'
import { EditPopover } from './EditPopover'
import type { CellEditorProps } from './types'

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
  const { timeZone, dateLocale } = commonOptionsOf(cell.table)
  const base = cell.column.getDataType()?.base ?? 'date'
  const timed = base === 'dateTime' || base === 'dateTimeString'
  const [wall, setWall] = useState(() => wallOf(props, timeZone))
  const original = cell.getValue()

  const save = (next = wall) => commit(valueOf(base, next, original, timeZone))
  const change = (next: Wall) => {
    setWall(next)
    setDraft(valueOf(base, next, original, timeZone))
  }

  return (
    <EditPopover
      text={text}
      label={label}
      testId="edit-date"
      initialFocus={popup =>
        popup?.querySelector<HTMLElement>(
          '[role="grid"] button[tabindex="0"]',
        ) ?? true
      }
      onCancel={cancel}
      onLeave={() => save()}
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
    </EditPopover>
  )
}
