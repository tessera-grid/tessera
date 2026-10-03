/**
 * Даты фильтра (ADR 0047, §2–§4). Значения сравниваются в «стенных минутах» пояса:
 * `Date.UTC` от календарных полей, какими их видят часы в `timeZone`. Календарный день
 * (`'YYYY-MM-DD'`) и ISO без смещения — уже стенное время, пояс к ним не применяется;
 * момент (`Date`, миллисекунды, ISO со смещением) переводится в часы пояса.
 */
import type { DateCellValue, DateFilter, DateFilterPreset } from './types'

const MINUTES_PER_DAY = 1440

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const WALL_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/
const WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/

const wallOf = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number | null => {
  const ms = Date.UTC(year, month - 1, day, hour, minute)
  const date = new Date(ms)
  // Отсекает несуществующие даты: 2026-02-30 у `Date.UTC` — 2 марта.
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour < 24 &&
    minute < 60
    ? ms / 60_000
    : null
}

const formatters = new Map<string, Intl.DateTimeFormat | null>()

const formatterOf = (timeZone: string) => {
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(
        timeZone,
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          hourCycle: 'h23',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        }),
      )
    } catch {
      // Неизвестный пояс — считаем в поясе браузера.
      formatters.set(timeZone, null)
    }
  }
  return formatters.get(timeZone)
}

/** Момент в стенных минутах пояса; без пояса — пояса браузера. */
export const instantToWall = (ms: number, timeZone?: string): number => {
  const formatter = timeZone ? formatterOf(timeZone) : null
  if (!formatter) {
    const date = new Date(ms)
    return (
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
      ) / 60_000
    )
  }
  const parts: Record<string, number> = {}
  for (const part of formatter.formatToParts(ms)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return (
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) /
    60_000
  )
}

/** Значение ячейки в стенных минутах; `null` — пустое или неразбираемое. */
export const cellToWall = (
  value: DateCellValue | unknown,
  timeZone?: string,
): number | null => {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms) ? null : instantToWall(ms, timeZone)
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? instantToWall(value, timeZone) : null
  }
  if (typeof value !== 'string') return null
  const text = value.trim()
  const day = DATE_ONLY.exec(text)
  if (day) return wallOf(+day[1], +day[2], +day[3])
  const wall = WALL_TIME.exec(text)
  if (wall) return wallOf(+wall[1], +wall[2], +wall[3], +wall[4], +wall[5])
  if (WITH_OFFSET.test(text)) {
    const ms = Date.parse(text)
    return Number.isNaN(ms) ? null : instantToWall(ms, timeZone)
  }
  return null
}

interface FilterBound {
  wall: number
  /** Граница со временем — сравнение по минутам, без — по дням. */
  hasTime: boolean
}

/** Значение фильтра: `'YYYY-MM-DD'` или `'YYYY-MM-DDTHH:mm'`. */
export const parseFilterDate = (value: unknown): FilterBound | null => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const day = DATE_ONLY.exec(text)
  if (day) {
    const wall = wallOf(+day[1], +day[2], +day[3])
    return wall === null ? null : { wall, hasTime: false }
  }
  const time = WALL_TIME.exec(text)
  if (time) {
    const wall = wallOf(+time[1], +time[2], +time[3], +time[4], +time[5])
    return wall === null ? null : { wall, hasTime: true }
  }
  return null
}

export const dayOf = (wall: number) => Math.floor(wall / MINUTES_PER_DAY)

const presetRange = (
  preset: DateFilterPreset,
  today: number,
): [number, number] | null => {
  switch (preset) {
    case 'today':
      return [today, today]
    case 'yesterday':
      return [today - 1, today - 1]
    case 'last7Days':
      return [today - 6, today]
    case 'last30Days':
      return [today - 29, today]
    case 'thisMonth':
    case 'thisYear': {
      const date = new Date(today * MINUTES_PER_DAY * 60_000)
      const year = date.getUTCFullYear()
      const month = preset === 'thisMonth' ? date.getUTCMonth() : 0
      const lastMonth = preset === 'thisMonth' ? month + 1 : 12
      return [
        dayOf(Date.UTC(year, month, 1) / 60_000),
        dayOf(Date.UTC(year, lastMonth, 0) / 60_000),
      ]
    }
    default:
      return null
  }
}

const isEmptyDateFilter = (filter: DateFilter) =>
  filter.operator === 'empty' || filter.operator === 'notEmpty'

/**
 * Ячейка (в стенных минутах) проходит фильтр даты. Граница без времени сравнивается
 * по дням, со временем — по минутам; неразбираемая граница фильтром не считается.
 */
export const matchesDate = (
  cell: number | null,
  filter: DateFilter,
  now: () => number,
): boolean => {
  if (filter.operator === 'empty') return cell === null
  if (filter.operator === 'notEmpty') return cell !== null
  if (filter.operator === 'preset') {
    const range = presetRange(filter.value, dayOf(now()))
    if (!range) return true
    if (cell === null) return false
    const day = dayOf(cell)
    return day >= range[0] && day <= range[1]
  }
  if (filter.operator === 'between') {
    const [from, to] = (filter.value ?? []).map(parseFilterDate)
    if (!from && !to) return true
    if (cell === null) return false
    return (
      (!from || compare(cell, from) >= 0) && (!to || compare(cell, to) <= 0)
    )
  }
  const bound = parseFilterDate(filter.value)
  if (!bound) return true
  if (cell === null) return false
  if (filter.operator === 'on') return dayOf(cell) === dayOf(bound.wall)
  const order = compare(cell, bound)
  return filter.operator === 'before' ? order < 0 : order > 0
}

const compare = (cell: number, bound: FilterBound) =>
  bound.hasTime
    ? Math.floor(cell) - bound.wall
    : dayOf(cell) - dayOf(bound.wall)

/** Фильтр даты ничего не отбирает — пустые или неразбираемые границы. */
export const isInactiveDateFilter = (filter: DateFilter): boolean => {
  if (isEmptyDateFilter(filter)) return false
  if (filter.operator === 'preset') return typeof filter.value !== 'string'
  if (filter.operator === 'between') {
    const [from, to] = Array.isArray(filter.value) ? filter.value : []
    return !parseFilterDate(from) && !parseFilterDate(to)
  }
  return !parseFilterDate(filter.value)
}

let lastNow: { timeZone?: string; minute: number; wall: number } | undefined

/** Стенные минуты «сейчас» в поясе; в пределах минуты — без пересчёта. */
export const nowWall = (timeZone?: string) => {
  const ms = Date.now()
  const minute = Math.floor(ms / 60_000)
  if (lastNow?.minute !== minute || lastNow.timeZone !== timeZone) {
    lastNow = { timeZone, minute, wall: instantToWall(ms, timeZone) }
  }
  return lastNow.wall
}

/** Стенные минуты → `'YYYY-MM-DD'` / `'YYYY-MM-DDTHH:mm'`. */
export const formatWall = (wall: number, withTime: boolean): string => {
  const iso = new Date(wall * 60_000).toISOString()
  return withTime ? iso.slice(0, 16) : iso.slice(0, 10)
}
