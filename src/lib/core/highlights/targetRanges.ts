/**
 * Цель «диапазон» подсветки и вспышки (ADR 0152, §4): прямоугольник ячеек между углами по
 * порядку строк и видимых колонок, как диапазон выделения. Одна запись при любом размере.
 */
import { getDisplayColumns } from '../displayColumns'
import { rowSourceOf } from '../rowSource'

/**
 * A rectangle of cells — the same shape as a selection range (ADR 0180, §6): row corners by
 * `id` or index, columns by `id`. When both corner `id`s are set, the range follows the rows;
 * otherwise it follows the indexes.
 */
export interface RangeTarget {
  range: {
    anchorRowIndex?: number
    focusRowIndex?: number
    anchorRowId?: string
    focusRowId?: string
    anchorColumnId: string
    focusColumnId: string
  }
}

/** Диапазон в срезе подсветки: углы строк — `id` или индексы, колонки — `id`. */
export interface RangeSpan {
  range: {
    rows:
      | readonly [from: string, to: string]
      | { indexes: readonly [from: number, to: number] }
    columns: readonly [from: string, to: string]
  }
}

/** Диапазон цели в виде среза: `id` углов главнее индексов. */
export const spanOf = ({ range }: RangeTarget): RangeSpan => ({
  range: {
    rows:
      range.anchorRowId !== undefined && range.focusRowId !== undefined
        ? [range.anchorRowId, range.focusRowId]
        : {
            indexes: [range.anchorRowIndex ?? -1, range.focusRowIndex ?? -1],
          },
    columns: [range.anchorColumnId, range.focusColumnId],
  },
})

export interface RangeBounds {
  minRow: number
  maxRow: number
  minColumn: number
  maxColumn: number
}

const SEP = '\u0000'

export const isIndexRows = (
  rows: RangeSpan['range']['rows'],
): rows is { indexes: readonly [number, number] } => 'indexes' in rows

/** Ключ диапазона в срезе. */
export const spanKey = ({ range }: RangeSpan): string => {
  const [c1, c2] = range.columns
  return isIndexRows(range.rows)
    ? ['g', 'i', ...range.rows.indexes, c1, c2].join(SEP)
    : ['g', 'd', ...range.rows, c1, c2].join(SEP)
}

export const rangeHighlightKey = (target: RangeTarget): string =>
  spanKey(spanOf(target))

export const isRangeKey = (key: string) => key.startsWith(`g${SEP}`)

/** Диапазон по ключу; `undefined` — ключ не диапазона. */
export const rangeOfKey = (key: string): RangeSpan | undefined => {
  if (!isRangeKey(key)) return undefined
  const [, kind, a, b, c1, c2] = key.split(SEP) as string[]
  const columns = [c1!, c2!] as const
  return kind === 'i'
    ? { range: { rows: { indexes: [Number(a), Number(b)] }, columns } }
    : { range: { rows: [a!, b!], columns } }
}

type DisplayRow = { id: string }
type OrderTable = {
  getRowsInDisplayOrder?: () => readonly DisplayRow[]
}

const displayIndexes = new WeakMap<readonly DisplayRow[], Map<string, number>>()

/**
 * Место строки по порядку диапазона: в серверной модели — индекс источника, иначе —
 * порядок отображения TanStack, как у выделения ячеек.
 */
export const rangeRowIndex = (table: unknown, rowId: string): number => {
  const source = rowSourceOf(table)
  const rows = (table as OrderTable).getRowsInDisplayOrder?.()
  if (source.keyByIndex || !rows) return source.indexOf(rowId)
  let indexes = displayIndexes.get(rows)
  if (!indexes) {
    indexes = new Map(rows.map((row, index) => [row.id, index]))
    displayIndexes.set(rows, indexes)
  }
  return indexes.get(rowId) ?? -1
}

export const rangeColumnIndex = (table: unknown, columnId: string): number =>
  getDisplayColumns(table as never).indexById.get(columnId) ?? -1

/** Границы диапазона в текущем порядке; `undefined` — угол не на виду или ушёл. */
export const rangeBounds = (
  table: unknown,
  { range }: RangeSpan,
): RangeBounds | undefined => {
  const [r1, r2] = isIndexRows(range.rows)
    ? range.rows.indexes
    : range.rows.map(id => rangeRowIndex(table, id))
  const c1 = rangeColumnIndex(table, range.columns[0])
  const c2 = rangeColumnIndex(table, range.columns[1])
  if (r1! < 0 || r2! < 0 || c1 < 0 || c2 < 0) return undefined
  return {
    minRow: Math.min(r1!, r2!),
    maxRow: Math.max(r1!, r2!),
    minColumn: Math.min(c1, c2),
    maxColumn: Math.max(c1, c2),
  }
}

const within = (bounds: RangeBounds, row: number, column: number) =>
  row >= bounds.minRow &&
  row <= bounds.maxRow &&
  column >= bounds.minColumn &&
  column <= bounds.maxColumn

const rangeKeys = new WeakMap<object, string[]>()

/** Ключи диапазонов среза — один раз на объект среза. */
const rangeKeysOf = (slice: Record<string, unknown>): string[] => {
  let keys = rangeKeys.get(slice)
  if (!keys) {
    keys = Object.keys(slice).filter(isRangeKey)
    rangeKeys.set(slice, keys)
  }
  return keys
}

/**
 * Записи диапазонов среза, накрывающие ячейку. Пустой срез и срез без диапазонов — без
 * обхода: ячейка тела зовёт это на каждую смену стора.
 */
export const rangeEntriesAt = <T>(
  table: unknown,
  slice: Record<string, T> | undefined,
  rowId: string,
  columnId: string,
): T[] => {
  if (!slice) return []
  const keys = rangeKeysOf(slice)
  if (keys.length === 0) return []
  const row = rangeRowIndex(table, rowId)
  const column = rangeColumnIndex(table, columnId)
  if (row < 0 || column < 0) return []
  const found: T[] = []
  for (const key of keys) {
    const bounds = rangeBounds(table, rangeOfKey(key)!)
    if (bounds && within(bounds, row, column)) found.push(slice[key]!)
  }
  return found
}

type Bound = {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}
type SelectionTable = OrderTable & {
  getCellSelectionBounds?: () => readonly Bound[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
}

/**
 * Выделение ячеек диапазонами — по прямоугольнику на каждый непересекающийся кусок
 * выделения, как его считает `cellSelection` (ADR 0152, §1).
 */
export const selectionRangeTargets = (table: unknown): RangeTarget[] => {
  const t = table as SelectionTable
  const bounds = t.getCellSelectionBounds?.() ?? []
  const indexes = t.getCellSelectionColumnIndexes?.() ?? {}
  if (bounds.length === 0) return []
  const columns: string[] = []
  for (const [id, index] of Object.entries(indexes)) columns[index] = id
  const byIndex = rowSourceOf(table).keyByIndex
  const rows = byIndex ? undefined : t.getRowsInDisplayOrder?.()
  const targets: RangeTarget[] = []
  for (const bound of bounds) {
    const c1 = columns[bound.minColumnIndex]
    const c2 = columns[bound.maxColumnIndex]
    if (c1 === undefined || c2 === undefined) continue
    const columnIds = { anchorColumnId: c1, focusColumnId: c2 }
    if (byIndex) {
      targets.push({
        range: {
          anchorRowIndex: bound.minRowIndex,
          focusRowIndex: bound.maxRowIndex,
          ...columnIds,
        },
      })
      continue
    }
    const r1 = rows?.[bound.minRowIndex]?.id
    const r2 = rows?.[bound.maxRowIndex]?.id
    if (r1 === undefined || r2 === undefined) continue
    targets.push({
      range: { anchorRowId: r1, focusRowId: r2, ...columnIds },
    })
  }
  return targets
}

/** Ячейка внутри диапазона в текущем порядке. */
export const rangeContains = (
  table: unknown,
  target: RangeTarget,
  rowId: string,
  columnId: string,
): boolean => {
  const bounds = rangeBounds(table, spanOf(target))
  if (!bounds) return false
  return within(
    bounds,
    rangeRowIndex(table, rowId),
    rangeColumnIndex(table, columnId),
  )
}
