/**
 * Протяжка значения и заполнение вниз и вправо (ADR 0219, §4–§5): значения исходных ячеек
 * продолжаются по видимым строкам и колонкам — копией, рядом или повтором — и уходят в канал
 * записи ядра; пишет плагин правки.
 */
import {
  type CellWrite,
  type CellWriteSource,
  writeCells,
} from '../../core/cellWrites'
import { resolveDataType } from '../../core/dataTypes'
import { reportAction } from '../../core/debugActions'
import { rowSourceOf } from '../../core/rowSource'
import { type FillKind, fillSeries } from '../../shared/fillSeries'
import { canPaste, columnOrderOf, isPassedRow } from './paste'
import type { FillContext, FillValue } from './types'

export interface Bounds {
  minRowIndex: number
  maxRowIndex: number
  minColumnIndex: number
  maxColumnIndex: number
}

interface FillRow {
  id: string
  groupingColumnId?: string
  getIsGrouped?: () => boolean
  getValue: (columnId: string) => unknown
}

interface FillTable {
  options: { timeZone?: string }
  getCellSelectionBounds?: () => Bounds[]
  getCellSelectionColumnIndexes?: () => Record<string, number>
  getColumn: (id: string) =>
    | {
        id: string
        columnDef: object
        getIsActionsColumn: () => boolean
      }
    | undefined
  setCellSelection?: (updater: (old: unknown[]) => unknown[]) => void
}

/** Куда тянут: ось, место последней цели в списке строк или колонок и сторона. */
export interface FillPlan {
  /** Исходный прямоугольник. */
  bound: Bounds
  axis: 'x' | 'y'
  /** Индекс последней строки (`y`) или колонки (`x`) цели. */
  to: number
}

/** Пропуск ячейки из `getFillValue`: ячейка остаётся как есть. */
const SKIP: unique symbol = Symbol('fill.skip')

const kindOfColumn = (
  table: unknown,
  columnId: string,
): FillKind | undefined => {
  const t = table as FillTable
  const column = t.getColumn(columnId)
  if (!column) return undefined
  const base = resolveDataType(table as never, column as never)?.base
  switch (base) {
    case undefined:
      return undefined
    case 'number':
      return 'number'
    case 'numberString':
      return 'decimal'
    case 'date':
    case 'dateTime':
    case 'dateString':
    case 'dateTimeString':
      return 'date'
    default:
      return 'none'
  }
}

/** Строки списка в отрезке, без строк, что места не занимают; незагруженная — конец. */
const rowsBetween = (table: unknown, from: number, to: number) => {
  const source = rowSourceOf<FillRow>(table)
  const rows: { row: FillRow; index: number }[] = []
  const step = from <= to ? 1 : -1
  const last = Math.min(Math.max(to, 0), source.count() - 1)
  for (let r = from; step > 0 ? r <= last : r >= last; r += step) {
    const row = source.at(r)
    if (!row) break
    if (!isPassedRow(table, row)) rows.push({ row, index: r })
  }
  return rows
}

/** Колонки в отрезке порядка показа без колонки действий. */
const columnsBetween = (
  table: unknown,
  order: readonly string[],
  from: number,
  to: number,
) => {
  const t = table as FillTable
  const ids: string[] = []
  const step = from <= to ? 1 : -1
  const last = Math.min(Math.max(to, 0), order.length - 1)
  for (let c = from; step > 0 ? c <= last : c >= last; c += step) {
    const id = order[c]
    if (id && !t.getColumn(id)?.getIsActionsColumn()) ids.push(id)
  }
  return ids
}

/** Изменения ячеек протяжки (WR23–WR26): по линиям вдоль оси, значение — по правилу ряда. */
export const fillChanges = (
  table: unknown,
  plan: FillPlan,
  {
    toggle = false,
    getFillValue,
  }: { toggle?: boolean; getFillValue?: FillValue } = {},
): CellWrite[] => {
  const t = table as FillTable
  const { bound, axis, to } = plan
  const order = columnOrderOf(t as never)
  const timeZone = t.options.timeZone
  const sourceRows = rowsBetween(table, bound.minRowIndex, bound.maxRowIndex)
  const sourceColumns = columnsBetween(
    table,
    order,
    bound.minColumnIndex,
    bound.maxColumnIndex,
  )
  const changes: CellWrite[] = []
  const vertical = axis === 'y'
  const max = vertical ? bound.maxRowIndex : bound.maxColumnIndex
  const min = vertical ? bound.minRowIndex : bound.minColumnIndex
  const backward = to < min
  if (!backward && to <= max) return changes
  const from = backward ? min - 1 : max + 1
  const direction = vertical
    ? backward
      ? 'up'
      : 'down'
    : backward
      ? 'left'
      : 'right'

  const line = (
    values: unknown[],
    kind: FillKind | undefined,
    targets: { rowId: string; columnId: string; row: FillRow }[],
  ) => {
    const at = fillSeries(values, { kind, toggle, backward, timeZone })
    targets.forEach((target, index) => {
      let value = at(index)
      if (getFillValue) {
        const own = getFillValue({
          values,
          index,
          direction,
          rowId: target.rowId,
          columnId: target.columnId,
          row: target.row,
          value,
          skip: SKIP,
        } satisfies FillContext)
        if (own === SKIP) return
        value = own
      }
      changes.push({ rowId: target.rowId, columnId: target.columnId, value })
    })
  }

  if (vertical) {
    const targetRows = rowsBetween(table, from, to)
    for (const columnId of sourceColumns) {
      line(
        sourceRows.map(({ row }) => row.getValue(columnId)),
        kindOfColumn(table, columnId),
        targetRows.map(({ row }) => ({ rowId: row.id, columnId, row })),
      )
    }
  } else {
    const targetColumns = columnsBetween(table, order, from, to)
    const kinds = sourceColumns.map(id => kindOfColumn(table, id))
    // Ряд по строке — у колонок одного вида значений.
    const kind = kinds.every(k => k === kinds[0]) ? kinds[0] : 'none'
    for (const { row } of sourceRows) {
      line(
        sourceColumns.map(id => row.getValue(id)),
        kind,
        targetColumns.map(columnId => ({ rowId: row.id, columnId, row })),
      )
    }
  }
  return changes
}

/** Выделить прямоугольник по местам строк и индексам колонок. */
export const selectBounds = (table: unknown, bound: Bounds) => {
  const t = table as FillTable
  const order = columnOrderOf(t as never)
  const left = order[bound.minColumnIndex]
  const right = order[bound.maxColumnIndex]
  const source = rowSourceOf<{ id: string }>(table)
  if (!left || !right) return
  if (source.keyByIndex === true) {
    t.setCellSelection?.(() => [
      {
        anchorRowIndex: bound.minRowIndex,
        focusRowIndex: bound.maxRowIndex,
        anchorColumnId: left,
        focusColumnId: right,
      },
    ])
    return
  }
  const first = source.at(bound.minRowIndex)
  const last = source.at(bound.maxRowIndex)
  if (!first || !last) return
  t.setCellSelection?.(() => [
    {
      anchorRowId: first.id,
      focusRowId: last.id,
      anchorColumnId: left,
      focusColumnId: right,
    },
  ])
}

/** Записать протяжку: пусто — ничего. */
export const writeFill = (
  table: unknown,
  changes: CellWrite[],
  source: CellWriteSource,
) => (changes.length === 0 ? undefined : writeCells(table, changes, { source }))

/**
 * Заполнить вниз или вправо (WR19): первой строкой или колонкой активного диапазона, на одной
 * ячейке — значением ячейки выше или слева. Копия, без ряда.
 */
export const fillFromEdge = (
  table: unknown,
  axis: 'x' | 'y',
  input: 'keyboard' | 'pointer',
): boolean => {
  if (!canPaste(table)) return false
  const t = table as FillTable
  const bound = t.getCellSelectionBounds?.().at(-1)
  if (!bound) return false
  const vertical = axis === 'y'
  const min = vertical ? bound.minRowIndex : bound.minColumnIndex
  const max = vertical ? bound.maxRowIndex : bound.maxColumnIndex
  let source: Bounds
  if (min === max) {
    // Одна строка или колонка: источник — соседняя выше или слева.
    const before = vertical
      ? rowsBetween(table, min - 1, 0)[0]?.index
      : (() => {
          const order = columnOrderOf(t as never)
          const id = columnsBetween(table, order, min - 1, 0)[0]
          return id === undefined ? undefined : order.indexOf(id)
        })()
    if (before === undefined) return false
    source = vertical
      ? { ...bound, minRowIndex: before, maxRowIndex: before }
      : { ...bound, minColumnIndex: before, maxColumnIndex: before }
  } else {
    source = vertical
      ? { ...bound, maxRowIndex: min }
      : { ...bound, maxColumnIndex: min }
  }
  // На одной ячейке целью становится она сама.
  const changes = fillChanges(table, { bound: source, axis, to: max })
  const kind = vertical ? 'fillDown' : 'fillRight'
  reportAction(table, {
    plugin: 'cellSelection',
    action: kind,
    detail: { cells: changes.length },
    source: input,
  })
  void writeFill(table, changes, kind)
  return true
}
