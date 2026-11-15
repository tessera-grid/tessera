/**
 * Сторож итога колонки в футере (ADR 0221, §9): итог вспыхивает, когда изменился из-за значений
 * строк или режима `aggregationScope`, а не из-за набора строк — поиска, фильтра, группировки,
 * смены агрегата или новой выборки сервера. Первое появление итога и невидимая ячейка — без
 * вспышки.
 */
import type { ColumnTotalWatch } from '../../core/commonFeature.types'
import {
  flashFooterTotals,
  type FlashOutcome,
} from '../../core/flashes/flashFeature'
import type { ValueChangeFlashHooks } from './types'
import { modeOf, nextFrame, type WatchColumn } from './watch'

interface TotalsTable {
  store: object & { get: () => Record<string, unknown> }
  getColumn: (columnId: string) => WatchColumn | undefined
  getRowSource: () => { epoch?: () => number | undefined }
}

/** Чем задан набор строк итога: отбор, группировка, агрегат и его режим, выборка сервера. */
interface RowSet {
  key: string
  epoch: number | null
  aggregationFn: unknown
  aggregationScope: unknown
}

const rowSets = new WeakMap<object, Map<string, RowSet>>()
const queues = new WeakMap<object, Map<string, FlashOutcome>>()

const rowSetOf = (table: TotalsTable, column: WatchColumn | undefined) => {
  const state = table.store.get()
  const columnDef = column?.columnDef as
    { aggregationFn?: unknown; aggregationScope?: unknown } | undefined
  return {
    key: JSON.stringify([
      state.globalFilter ?? '',
      state.columnFilters ?? [],
      state.grouping ?? [],
    ]),
    epoch: table.getRowSource().epoch?.() ?? null,
    aggregationFn: columnDef?.aggregationFn,
    aggregationScope: columnDef?.aggregationScope,
  }
}

/**
 * Итог сравним с прежним: тот же отбор и агрегат. Смена режима — тот же набор шире или уже,
 * даже с новой выборкой сервера, которую режим и начал (VC24).
 */
const sameRowSet = (a: RowSet | undefined, b: RowSet) =>
  !!a &&
  a.key === b.key &&
  a.aggregationFn === b.aggregationFn &&
  (a.aggregationScope !== b.aggregationScope || a.epoch === b.epoch)

/** Равенство итогов: числа и даты по значению, списки и объекты — по элементам. */
const sameTotal = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameTotal(item, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a)
    return (
      keys.length === Object.keys(b).length &&
      keys.every(key =>
        sameTotal(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
      )
    )
  }
  return false
}

const outcomeOf = (
  previous: unknown,
  total: unknown,
  direction: boolean,
): FlashOutcome =>
  direction &&
  typeof previous === 'number' &&
  typeof total === 'number' &&
  Number.isFinite(previous) &&
  Number.isFinite(total)
    ? total > previous
      ? 'up'
      : 'down'
    : 'changed'

/** Ячейка в видимой части области прокрутки: строка итогов за краем не вспыхивает. */
const visible = (element: HTMLElement | null) => {
  if (!element) return false
  const scroller = element.closest('.data-grid__container')
  if (!scroller) return true
  const box = element.getBoundingClientRect()
  const frame = scroller.getBoundingClientRect()
  return box.bottom > frame.top && box.top < frame.bottom
}

const enqueue = (
  table: TotalsTable,
  columnId: string,
  outcome: FlashOutcome,
) => {
  let queue = queues.get(table.store)
  if (!queue) {
    const pending = new Map<string, FlashOutcome>()
    queue = pending
    queues.set(table.store, pending)
    nextFrame(() => {
      queues.delete(table.store)
      flashFooterTotals(
        table,
        [...pending].map(([id, kind]) => ({ columnId: id, outcome: kind })),
      )
    })
  }
  queue.set(columnId, outcome)
}

/** Сторож итогов с умолчанием колонок плагина. */
export const watchTotalsWith =
  (columnDefault: ValueChangeFlashHooks['columnDefault']) =>
  ({
    table: raw,
    columnId,
    total,
    previous,
    mounted,
    element,
  }: ColumnTotalWatch) => {
    const table = raw as TotalsTable
    const column = table.getColumn(columnId)
    const rowSet = rowSetOf(table, column)
    let seen = rowSets.get(table.store)
    if (!seen) {
      seen = new Map()
      rowSets.set(table.store, seen)
    }
    const before = seen.get(columnId)
    seen.set(columnId, rowSet)
    // Первое появление и уход итога, смена набора строк — без вспышки.
    if (mounted || previous == null || total == null) return
    if (!sameRowSet(before, rowSet) || !column) return
    const mode = modeOf(column, columnDefault)
    if (mode === false || sameTotal(previous, total) || !visible(element)) {
      return
    }
    enqueue(table, columnId, outcomeOf(previous, total, mode === 'direction'))
  }
