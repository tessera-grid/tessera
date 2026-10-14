/**
 * План движения колонок (ADR 0115, CN12): по видимым позициям колонок до смены порядка и
 * колонкам окна после неё — сдвиги по X и призраки уходящих далеко.
 */

/** Колонка окна после смены: левый край и ширина, px от начала таблицы. */
export interface MotionColumn {
  id: string
  left: number
  width: number
}

export interface ColumnMotionInput {
  /** Видимые левые края колонок окна до смены: `id` → px от начала таблицы. */
  before: ReadonlyMap<string, number>
  after: readonly MotionColumn[]
  /** Левый край колонки в прежней раскладке; `undefined` — её там не было. */
  prevLeftOf: (id: string) => number | undefined
  /** Левый край колонки в новой раскладке; `undefined` — её там нет. */
  nextLeftOf: (id: string) => number | undefined
  widthOf: (id: string) => number
}

/** Колонка, ушедшая из окна: призрак едет от `from` к `to`. */
export interface ColumnMotionExit {
  id: string
  from: number
  to: number
}

export interface ColumnMotionPlan {
  /** Стартовый сдвиг колонки окна: `id` → `dx`, старт — `left + dx`. */
  moves: Map<string, number>
  exits: ColumnMotionExit[]
}

/** Сдвиг меньше полупикселя — колонка на месте. */
const STILL = 0.5

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/** `null` — двигать нечего: до смены колонок не было или ни одна не уцелела в окне. */
export const planColumnMotion = ({
  before,
  after,
  prevLeftOf,
  nextLeftOf,
  widthOf,
}: ColumnMotionInput): ColumnMotionPlan | null => {
  if (before.size === 0 || !after.some(column => before.has(column.id))) {
    return null
  }

  // Колонка издалека въезжает от края окна, уходящая — уезжает к нему (§3).
  const edgeLeft = Math.min(...after.map(column => column.left))
  const edgeRight = Math.max(...after.map(column => column.left + column.width))
  const toWindow = (left: number, width: number) =>
    clamp(left, edgeLeft - width, edgeRight)

  const moves = new Map<string, number>()
  for (const column of after) {
    let from = before.get(column.id)
    if (from === undefined) {
      const prev = prevLeftOf(column.id)
      if (prev === undefined) continue
      from = toWindow(prev, column.width)
    }
    const dx = from - column.left
    if (Math.abs(dx) >= STILL) moves.set(column.id, dx)
  }

  const mounted = new Set(after.map(column => column.id))
  const exits: ColumnMotionExit[] = []
  for (const [id, from] of before) {
    if (mounted.has(id)) continue
    const next = nextLeftOf(id)
    if (next === undefined) continue
    exits.push({ id, from, to: toWindow(next, widthOf(id)) })
  }

  return { moves, exits }
}
