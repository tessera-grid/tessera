/**
 * План движения строк (ADR 0107, RM18): по видимым позициям строк окна до смены модели
 * и строкам окна после неё — сдвиги, появления и призраки уходящих.
 */

/** Строка окна после смены модели. */
export interface MotionRow {
  id: string
  /** Индекс в новой модели. */
  index: number
  /** Верх строки, px от начала тела. */
  start: number
  /** Высота строки, px; нет — `rowSize`. */
  size?: number
}

export interface RowMotionInput {
  /** Видимые позиции строк окна до смены: `id` → верх, px от начала тела. */
  before: ReadonlyMap<string, number>
  /** Строки окна после смены, по возрастанию индекса. */
  after: readonly MotionRow[]
  /** Высота строки, px. */
  rowSize: number
  /** Верх строки модели по индексу. */
  startOf: (index: number) => number
  /** Индекс строки в прошлой модели; `undefined` — её там не было. */
  prevIndexOf: (id: string) => number | undefined
  /** Индекс строки в новой модели; `undefined` — она ушла из модели. */
  nextIndexOf: (id: string) => number | undefined
}

/** Строка, ушедшая из окна: призрак от `from` к `to` или гаснущий на месте (`to: null`). */
export interface RowMotionExit {
  id: string
  from: number
  to: number | null
}

export interface RowMotionPlan {
  /** Стартовый сдвиг строки окна: `id` → `dy`, старт — `start + dy`. */
  moves: Map<string, number>
  /** Строки, которых не было в модели: проявляются на месте. */
  enters: string[]
  exits: RowMotionExit[]
}

/** Сдвиг меньше полупикселя — строка на месте. */
const STILL = 0.5

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/**
 * `null` — двигать нечего: до смены строк не было или из строк окна не уцелела ни одна
 * (замена целиком, RM6).
 */
export const planRowMotion = ({
  before,
  after,
  rowSize,
  startOf,
  prevIndexOf,
  nextIndexOf,
}: RowMotionInput): RowMotionPlan | null => {
  if (before.size === 0 || !after.some(row => before.has(row.id))) {
    return null
  }

  // Строка издалека въезжает от края окна, уходящая — уезжает к нему (§4).
  const top = after.length > 0 ? after[0].start : 0
  const last = after[after.length - 1]
  const bottom = last ? last.start + (last.size ?? rowSize) : 0
  const toWindow = (start: number) => clamp(start, top - rowSize, bottom)

  const moves = new Map<string, number>()
  const enters: string[] = []
  for (const row of after) {
    const seen = before.get(row.id)
    if (seen === undefined) {
      const prevIndex = prevIndexOf(row.id)
      if (prevIndex === undefined) {
        enters.push(row.id)
        continue
      }
      const dy = toWindow(startOf(prevIndex)) - row.start
      if (Math.abs(dy) >= STILL) moves.set(row.id, dy)
      continue
    }
    const dy = seen - row.start
    if (Math.abs(dy) >= STILL) moves.set(row.id, dy)
  }

  const mounted = new Set(after.map(row => row.id))
  const exits: RowMotionExit[] = []
  for (const [id, from] of before) {
    if (mounted.has(id)) continue
    const nextIndex = nextIndexOf(id)
    exits.push({
      id,
      from,
      to: nextIndex === undefined ? null : toWindow(startOf(nextIndex)),
    })
  }

  return { moves, enters, exits }
}
