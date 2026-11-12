/**
 * Стенное время пояса (ADR 0047, §2; ADR 0073, §3): `Date.UTC` от календарных полей,
 * какими их видят часы в `timeZone`, в миллисекундах. Календарный день
 * (`'YYYY-MM-DD'`) и ISO без смещения — уже стенное время, пояс к ним не применяется;
 * момент (`Date`, миллисекунды, ISO со смещением) переводится в часы пояса.
 */

export const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
export const WALL_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/
const WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/

/** Стенное время из полей; `null` — несуществующая дата (2026-02-30) или время. */
export const wallMsOf = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number | null => {
  const ms = Date.UTC(year, month - 1, day, hour, minute, second)
  const date = new Date(ms)
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    second < 60
    ? ms
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
          second: 'numeric',
        }),
      )
    } catch {
      // Неизвестный пояс — считаем в поясе браузера.
      formatters.set(timeZone, null)
    }
  }
  return formatters.get(timeZone)
}

/** Момент в стенных миллисекундах пояса (с точностью до секунды); без пояса — браузера. */
export const instantToWallMs = (ms: number, timeZone?: string): number => {
  const formatter = timeZone ? formatterOf(timeZone) : null
  if (!formatter) {
    const date = new Date(ms)
    return Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    )
  }
  const parts: Record<string, number> = {}
  for (const part of formatter.formatToParts(ms)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
}

/**
 * Момент, который часы пояса показывают как `wallMs` (ADR 0219, WR5); без пояса — пояс
 * браузера. Смещение уточняется вторым шагом: на переходе на летнее время оно другое.
 */
export const wallMsToInstant = (wallMs: number, timeZone?: string): number => {
  let instant = wallMs - (instantToWallMs(wallMs, timeZone) - wallMs)
  instant = wallMs - (instantToWallMs(instant, timeZone) - instant)
  return instant
}

export interface WallValue {
  ms: number
  /** Календарный день без времени (`'YYYY-MM-DD'`). */
  dateOnly: boolean
}

/** Значение ячейки в стенном времени; `null` — пустое или неразбираемое. */
export const cellToWallValue = (
  value: unknown,
  timeZone?: string,
): WallValue | null => {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms)
      ? null
      : { ms: instantToWallMs(ms, timeZone), dateOnly: false }
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { ms: instantToWallMs(value, timeZone), dateOnly: false }
      : null
  }
  if (typeof value !== 'string') return null
  const text = value.trim()
  const day = DATE_ONLY.exec(text)
  if (day) {
    const ms = wallMsOf(+day[1], +day[2], +day[3])
    return ms === null ? null : { ms, dateOnly: true }
  }
  const wall = WALL_TIME.exec(text)
  if (wall) {
    const ms = wallMsOf(
      +wall[1],
      +wall[2],
      +wall[3],
      +wall[4],
      +wall[5],
      +(wall[6] ?? 0),
    )
    return ms === null ? null : { ms, dateOnly: false }
  }
  if (WITH_OFFSET.test(text)) {
    const ms = Date.parse(text)
    return Number.isNaN(ms)
      ? null
      : { ms: instantToWallMs(ms, timeZone), dateOnly: false }
  }
  return null
}
