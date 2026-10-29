/**
 * Диапазоны подсветки и вспышки на индексах серверной модели следуют за списком, как
 * выделение (ADR 0152, §4; ADR 0146, §6): новая выборка снимает их, смена строк выше
 * сдвигает, внутри — снимает.
 */
import type { Updater } from '../../types'
import { readFlashes } from '../flashes/flashFeature'
import { followRowList, followSpans, shiftIndexSpan } from '../rowListFollow'
import type { RowListChange } from '../rowSource'
import { readHighlights } from './highlightFeature'
import {
  isIndexRows,
  rangeHighlightKey,
  rangeOfKey,
  type RangeTarget,
} from './targetRanges'

type Slice = Record<string, unknown>

const indexRangeKeys = (slice: Slice) =>
  Object.keys(slice).filter(key => {
    const range = rangeOfKey(key)
    return range !== undefined && isIndexRows(range.range.rows)
  })

const shiftTarget = (
  target: RangeTarget,
  change: RowListChange,
): RangeTarget | null => {
  const { rows, columns } = target.range
  if (!isIndexRows(rows)) return target
  const [from, to] = rows.indexes
  const delta = shiftIndexSpan(Math.min(from, to), Math.max(from, to), change)
  if (delta === null) return null
  if (delta === 0) return target
  return { range: { rows: { indexes: [from + delta, to + delta] }, columns } }
}

/** Срез с диапазонами на новых местах; ушедшие — убраны. */
const moved = <T extends Slice>(
  slice: T,
  batches: readonly (readonly RowListChange[])[] | undefined,
): T => {
  const keys = indexRangeKeys(slice)
  if (keys.length === 0) return slice
  const next: Slice = { ...slice }
  let changed = false
  for (const key of keys) {
    const [target] = batches
      ? (followSpans([rangeOfKey(key)!], batches, shiftTarget) ?? [])
      : []
    const nextKey = target && rangeHighlightKey(target)
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
  const apply = (batches?: readonly (readonly RowListChange[])[]) => {
    if (indexRangeKeys(readHighlights(table)).length > 0) {
      t.setHighlights?.(prev => moved(prev, batches))
    }
    if (indexRangeKeys(readFlashes(table)).length > 0) {
      t.setFlashes?.(prev => moved(prev, batches))
    }
  }
  return followRowList(table, {
    active: () =>
      indexRangeKeys(readHighlights(table)).length > 0 ||
      indexRangeKeys(readFlashes(table)).length > 0,
    reset: () => apply(),
    shift: batches => apply(batches),
  })
}
