/**
 * Диапазоны подсветки и вспышки на индексах серверной модели следуют за списком, как
 * выделение (ADR 0152, §4; ADR 0146, §6): новая выборка снимает их, смена строк выше
 * сдвигает, внутри — снимает. Новая строка слоя ведёт углы по отдельности: внутри диапазона он
 * растёт, а её уход и запись в кэш оставляют те же углы (ADR 0178, DR51).
 */
import type { Updater } from '../../types'
import { readFlashes } from '../flashes/flashFeature'
import {
  followIndex,
  followRowList,
  followSpans,
  shiftIndexSpan,
} from '../rowListFollow'
import type { RowListChange } from '../rowSource'
import { readHighlights } from './highlightFeature'
import {
  isIndexRows,
  rangeOfKey,
  type RangeSpan,
  spanKey,
} from './targetRanges'

type Slice = Record<string, unknown>

const indexRangeKeys = (slice: Slice) =>
  Object.keys(slice).filter(key => {
    const range = rangeOfKey(key)
    return range !== undefined && isIndexRows(range.range.rows)
  })

const shiftTarget = (
  target: RangeSpan,
  change: RowListChange,
): RangeSpan | null => {
  const { rows, columns } = target.range
  if (!isIndexRows(rows)) return target
  const [from, to] = rows.indexes
  const delta = shiftIndexSpan(Math.min(from, to), Math.max(from, to), change)
  if (delta === null) return null
  if (delta === 0) return target
  return { range: { rows: { indexes: [from + delta, to + delta] }, columns } }
}

type Batches = readonly (readonly RowListChange[])[]
type Follow = (target: RangeSpan) => RangeSpan | undefined

const followCorners = (target: RangeSpan, batches: Batches): RangeSpan => {
  const { rows, columns } = target.range
  if (!isIndexRows(rows)) return target
  const [from, to] = rows.indexes
  return {
    range: {
      rows: { indexes: [followIndex(from, batches), followIndex(to, batches)] },
      columns,
    },
  }
}

/** Срез с диапазонами на новых местах; ушедшие — убраны. */
const moved = <T extends Slice>(slice: T, follow: Follow): T => {
  const keys = indexRangeKeys(slice)
  if (keys.length === 0) return slice
  const next: Slice = { ...slice }
  let changed = false
  for (const key of keys) {
    const target = follow(rangeOfKey(key)!)
    const nextKey = target && spanKey(target)
    if (nextKey === key) continue
    changed = true
    const value = slice[key]
    delete next[key]
    if (nextKey) next[nextKey] = value
  }
  return changed ? (next as T) : slice
}

type FollowTable = {
  setHighlights?: (updater: Updater<Slice>) => void
  setFlashes?: (updater: Updater<Slice>) => void
}

export const followIndexRanges = (table: unknown) => {
  const t = table as FollowTable
  const apply = (follow: Follow) => {
    if (indexRangeKeys(readHighlights(table)).length > 0) {
      t.setHighlights?.(prev => moved(prev, follow))
    }
    if (indexRangeKeys(readFlashes(table)).length > 0) {
      t.setFlashes?.(prev => moved(prev, follow))
    }
  }
  return followRowList(table, {
    active: () =>
      indexRangeKeys(readHighlights(table)).length > 0 ||
      indexRangeKeys(readFlashes(table)).length > 0,
    reset: () => apply(() => undefined),
    shift: batches =>
      apply(target => followSpans([target], batches, shiftTarget)?.[0]),
    newRows: batches => apply(target => followCorners(target, batches)),
  })
}
