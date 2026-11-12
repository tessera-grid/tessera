/**
 * Правила ряда протяжки значения (ADR 0219, §4): одно значение — копия, два и больше с
 * постоянным шагом — ряд чисел, десятичных строк и дат, иначе — повтор по кругу; Alt
 * переключает копию и ряд. Чистые функции: значение ячейки протяжки по её номеру.
 */
import {
  DATE_ONLY,
  WALL_TIME,
  instantToWallMs,
  wallMsOf,
  wallMsToInstant,
} from './wallTime'

/** Как считать ряд: числа, десятичные строки, даты; `'none'` — только копия и повтор. */
export type FillKind = 'number' | 'decimal' | 'date' | 'none'

export interface FillSeriesOptions {
  /** Тип значений; без него — по самим значениям: числа и `Date`. */
  kind?: FillKind
  /** Alt/Option во время протяжки: копия становится рядом, ряд — повтором. */
  toggle?: boolean
  /** Протяжка вверх или влево: ячейки перед первым исходным значением. */
  backward?: boolean
  /** Пояс таблицы: шаг дат-моментов — в его календаре. */
  timeZone?: string
}

/** Значение ячейки протяжки: `index` — 0 у ближайшей к исходным, дальше — по порядку. */
export type FillValueAt = (index: number) => unknown

const DAY_MS = 86_400_000
const DECIMAL = /^-?\d+(?:\.(\d+))?$/

const kindOf = (values: readonly unknown[]): FillKind => {
  if (values.every(v => typeof v === 'number' && Number.isFinite(v)))
    return 'number'
  if (values.every(v => v instanceof Date && !Number.isNaN(v.getTime())))
    return 'date'
  return 'none'
}

/** Позиция ячейки протяжки относительно первого исходного значения. */
const positionOf = (index: number, count: number, backward: boolean) =>
  backward ? -(index + 1) : count + index

/** Повтор по кругу; назад — от последнего значения к первому. */
const cycle =
  (values: readonly unknown[], backward: boolean): FillValueAt =>
  index => {
    const n = values.length
    const k = index % n
    return values[backward ? n - 1 - k : k]
  }

const decimalsOf = (value: number) => {
  const text = String(value)
  const exponent = /e-(\d+)$/.exec(text)
  if (exponent) return Number(exponent[1])
  return text.split('.')[1]?.length ?? 0
}

const numberSeries = (
  values: readonly number[],
  single: boolean,
  backward: boolean,
): FillValueAt | undefined => {
  const first = values[0]!
  const step = single ? 1 : values[1]! - first
  const scale = Math.max(1, ...values.map(Math.abs))
  for (let i = 2; i < values.length; i++) {
    if (Math.abs(values[i]! - values[i - 1]! - step) > 1e-9 * scale)
      return undefined
  }
  // Сумма float даёт хвосты (0.1 + 0.2): ряд округляется до знаков исходных значений.
  const decimals = Math.min(
    15,
    Math.max(decimalsOf(step), ...values.map(decimalsOf)),
  )
  return index =>
    Number(
      (first + step * positionOf(index, values.length, backward)).toFixed(
        decimals,
      ),
    )
}

const toScaled = (text: string, scale: number) => {
  const negative = text.startsWith('-')
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.')
  const digits = BigInt(whole! + fraction.padEnd(scale, '0'))
  return negative ? -digits : digits
}

const fromScaled = (value: bigint, scale: number) => {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(scale + 1, '0')
  const text =
    scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  return negative ? `-${text}` : text
}

/** Десятичные строки — целыми со сдвигом запятой, без float (ADR 0174, TY12). */
const decimalSeries = (
  values: readonly unknown[],
  single: boolean,
  backward: boolean,
): FillValueAt | undefined => {
  if (!values.every(v => typeof v === 'string' && DECIMAL.test(v)))
    return undefined
  const texts = values as readonly string[]
  const scale = Math.max(...texts.map(t => DECIMAL.exec(t)![1]?.length ?? 0))
  const scaled = texts.map(t => toScaled(t, scale))
  const one = 10n ** BigInt(scale)
  const step = single ? one : scaled[1]! - scaled[0]!
  for (let i = 2; i < scaled.length; i++) {
    if (scaled[i]! - scaled[i - 1]! !== step) return undefined
  }
  return index =>
    fromScaled(
      scaled[0]! + step * BigInt(positionOf(index, texts.length, backward)),
      scale,
    )
}

/** Дата в стенном времени и как вернуть её в тот же вид. */
interface WallDate {
  ms: number
  back: (ms: number) => unknown
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

const wallDateOf = (
  value: unknown,
  timeZone?: string,
): WallDate | undefined => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined
    return {
      ms: instantToWallMs(value.getTime(), timeZone),
      back: ms => new Date(wallMsToInstant(ms, timeZone)),
    }
  }
  if (typeof value !== 'string') return undefined
  const day = DATE_ONLY.exec(value)
  if (day) {
    const ms = wallMsOf(+day[1]!, +day[2]!, +day[3]!)
    if (ms === null) return undefined
    return { ms, back: ms => new Date(ms).toISOString().slice(0, 10) }
  }
  const wall = WALL_TIME.exec(value)
  if (!wall) return undefined
  const ms = wallMsOf(
    +wall[1]!,
    +wall[2]!,
    +wall[3]!,
    +wall[4]!,
    +wall[5]!,
    +(wall[6] ?? 0),
  )
  if (ms === null) return undefined
  const separator = value[10]!
  const seconds = wall[6] !== undefined
  return {
    ms,
    back: ms => {
      const d = new Date(ms)
      const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds ? `:${pad(d.getUTCSeconds())}` : ''}`
      return `${d.toISOString().slice(0, 10)}${separator}${time}`
    },
  }
}

/** Сдвиг на `months` с тем же числом месяца; числа нет в месяце — последний день. */
const addMonths = (ms: number, months: number) => {
  const d = new Date(ms)
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1),
  )
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(d.getUTCDate(), last))
  return target.getTime() + (ms % DAY_MS)
}

const monthIndex = (ms: number) => {
  const d = new Date(ms)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

const dateSeries = (
  values: readonly unknown[],
  single: boolean,
  backward: boolean,
  timeZone: string | undefined,
): FillValueAt | undefined => {
  const dates = values.map(v => wallDateOf(v, timeZone))
  if (dates.some(d => !d)) return undefined
  const walls = dates as WallDate[]
  const first = walls[0]!
  const at = (ms: number) => first.back(ms)
  const n = walls.length
  if (single) {
    return index => at(first.ms + DAY_MS * positionOf(index, 1, backward))
  }
  // Месяцы и годы: то же число и время, постоянный шаг месяцев.
  const sameDay = walls.every(
    w =>
      new Date(w.ms).getUTCDate() === new Date(first.ms).getUTCDate() &&
      w.ms % DAY_MS === first.ms % DAY_MS,
  )
  const monthStep = monthIndex(walls[1]!.ms) - monthIndex(first.ms)
  if (
    sameDay &&
    monthStep !== 0 &&
    walls.every(
      (w, i) => monthIndex(w.ms) - monthIndex(first.ms) === monthStep * i,
    )
  ) {
    return index =>
      at(addMonths(first.ms, monthStep * positionOf(index, n, backward)))
  }
  const step = walls[1]!.ms - first.ms
  if (step === 0 || walls.some((w, i) => w.ms - first.ms !== step * i))
    return undefined
  return index => at(first.ms + step * positionOf(index, n, backward))
}

/**
 * Значения протяжки по исходным значениям одной линии вдоль оси (WR24–WR25): копия, ряд или
 * повтор по кругу. Пустых исходных нет — пустое значение даёт повтор.
 */
export const fillSeries = (
  values: readonly unknown[],
  options: FillSeriesOptions = {},
): FillValueAt => {
  const { toggle = false, backward = false, timeZone } = options
  if (values.length === 0) return () => undefined
  const single = values.length === 1
  // Одно значение — копия, Alt — ряд; несколько — ряд, Alt — повтор.
  const wantSeries = single ? toggle : !toggle
  const kind = options.kind ?? kindOf(values)
  if (wantSeries) {
    const series =
      kind === 'number'
        ? kindOf(values) === 'number'
          ? numberSeries(values as number[], single, backward)
          : undefined
        : kind === 'decimal'
          ? decimalSeries(values, single, backward)
          : kind === 'date'
            ? dateSeries(values, single, backward, timeZone)
            : undefined
    if (series) return series
  }
  return cycle(values, backward)
}
