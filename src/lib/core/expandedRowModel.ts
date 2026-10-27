/**
 * Модель раскрытия из прошлой (ADR 0070): заново обходятся только корни, затронутые
 * сменой модели на входе или среза `expanded`; участки остальных копируются. Первая
 * сборка, «раскрыто всё», смена числа корней и больше половины затронутых корней —
 * модель TanStack.
 */
import { createExpandedRowModel } from '@tanstack/react-table'

import type { RowData, Table, TableFeatures } from '../types'
import type { NarrowState } from './effectiveState'
import { recordRowChange } from './rowChanges'

interface ExpandRow {
  id: string
  parentId?: string
  subRows: ExpandRow[]
  getIsExpanded: () => boolean
}

interface ExpandModel {
  rows: ExpandRow[]
  flatRows: ExpandRow[]
  rowsById: Record<string, ExpandRow>
}

type Expanded = true | Record<string, boolean>

interface ExpandTable {
  atoms: { expanded?: { get: () => Expanded | undefined } }
  options: {
    paginateExpandedRows?: boolean
    manualPagination?: boolean
    getIsRowExpanded?: unknown
  }
  getPreExpandedRowModel: () => ExpandModel
}

interface Built {
  input: ExpandModel
  expanded: Expanded
  paginate: unknown
  output: ExpandModel
  /** Из результата можно собрать следующий инкрементом. */
  patchable: boolean
  /**
   * Начало участка каждого корня в `output.rows`, последний элемент — длина; после
   * полной сборки считается перед первым инкрементом.
   */
  starts?: Int32Array
}

const NO_EXPANDED: Record<string, boolean> = {}

/**
 * Выключенная модель дерева показывает одни корни, сохранённый срез `expanded` не
 * меняется (ADR 0119). Модель включена, если её включила хоть одна запись.
 */
export const narrowExpandingOff: NarrowState = (value, _table, context) =>
  context.options.enableExpanding === false ? NO_EXPANDED : value
/** Сколько строк вставлять одним `splice`: аргументы вызова ограничены стеком. */
const SPLICE_LIMIT = 10_000

const isExpandedId = (expanded: Record<string, boolean>, id: string) =>
  Object.hasOwn(expanded, id) && !!expanded[id]

/** Строка и дети раскрытых строк — обход `expandRows` TanStack. */
const walk = (row: ExpandRow, into: ExpandRow[]) => {
  into.push(row)
  if (row.subRows.length && row.getIsExpanded()) {
    for (const child of row.subRows) {
      walk(child, into)
    }
  }
}

/** Начала участков корней в выходных строках. */
const rootStarts = (
  roots: readonly ExpandRow[],
  rows: readonly ExpandRow[],
) => {
  const starts = new Int32Array(roots.length + 1)
  let root = 0
  for (let i = 0; i < rows.length && root < roots.length; i++) {
    if (rows[i] === roots[root]) {
      starts[root++] = i
    }
  }
  starts[roots.length] = rows.length
  return starts
}

/** Индексы корней, затронутых сменой входа или `expanded`; `undefined` — нужна полная сборка. */
const affectedRoots = (
  last: Built & { starts: Int32Array },
  input: ExpandModel,
  expanded: Record<string, boolean>,
) => {
  const roots = input.rows
  const lastRoots = last.input.rows
  const affected = new Set<number>()
  const limit = roots.length / 2
  for (let i = 0; i < roots.length; i++) {
    if (roots[i] !== lastRoots[i]) {
      affected.add(i)
      if (affected.size > limit) {
        return undefined
      }
    }
  }
  if (expanded !== last.expanded) {
    const lastExpanded = last.expanded as Record<string, boolean>
    const ids = new Set([
      ...Object.keys(lastExpanded),
      ...Object.keys(expanded),
    ])
    for (const id of ids) {
      if (isExpandedId(lastExpanded, id) === isExpandedId(expanded, id)) {
        continue
      }
      // Строки нет в модели — раскрывать нечего; корень не найден — сборка заново.
      let row = input.rowsById[id]
      if (!row) {
        continue
      }
      while (row?.parentId !== undefined) {
        row = input.rowsById[row.parentId]
      }
      const at = row ? roots.indexOf(row) : -1
      if (at < 0) {
        return undefined
      }
      affected.add(at)
      if (affected.size > limit) {
        return undefined
      }
    }
  }
  return [...affected].sort((a, b) => a - b)
}

export const createIncrementalExpandedRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as ExpandTable
    const stock = createExpandedRowModel<TFeatures, TData>()(table)
    let last: Built | undefined

    const full = (
      input: ExpandModel,
      expanded: Expanded,
      paginate: unknown,
    ): Built => {
      const output = stock() as unknown as ExpandModel
      // Без пагинации раскрытых строк (`paginateExpandedRows`) раскрывает модель
      // страницы, а эта отдаёт вход как есть.
      const expands =
        !!t.options.paginateExpandedRows || !!t.options.manualPagination
      return {
        input,
        expanded,
        paginate,
        output,
        patchable: expands && expanded !== true,
      }
    }

    const patch = (
      prev: Built & { starts: Int32Array },
      input: ExpandModel,
      expanded: Record<string, boolean>,
      paginate: unknown,
    ): Built | undefined => {
      const affected = affectedRoots(prev, input, expanded)
      if (!affected) {
        return undefined
      }
      const roots = input.rows
      // Одна копия прошлого результата; участки затронутых корней заменяются с конца —
      // начала участков перед ними не сдвигаются.
      const rows = prev.output.rows.slice()
      const starts = prev.starts.slice()
      for (let k = affected.length - 1; k >= 0; k--) {
        const at = affected[k]!
        const from = prev.starts[at]!
        const removed = prev.starts[at + 1]! - from
        const piece: ExpandRow[] = []
        walk(roots[at]!, piece)
        rows.splice(from, removed)
        for (let i = 0; i < piece.length; i += SPLICE_LIMIT) {
          rows.splice(from + i, 0, ...piece.slice(i, i + SPLICE_LIMIT))
        }
        const shift = piece.length - removed
        if (shift !== 0) {
          for (let i = at + 1; i <= roots.length; i++) {
            starts[i]! += shift
          }
        }
      }
      // Первая строка, чей id отличается от прежней, — подсказка виртуализатору (ADR 0145).
      const before = prev.output.rows
      const end = Math.min(
        starts[affected[affected.length - 1]! + 1]!,
        before.length,
      )
      let from = prev.starts[affected[0]!]!
      while (from < end && rows[from]!.id === before[from]!.id) {
        from++
      }
      recordRowChange(rows, before, from)
      return {
        input,
        expanded,
        paginate,
        output: {
          rows,
          flatRows: input.flatRows,
          rowsById: input.rowsById,
        },
        patchable: true,
        starts,
      }
    }

    return () => {
      const input = t.getPreExpandedRowModel()
      const expanded = t.atoms.expanded?.get() ?? NO_EXPANDED
      const { paginateExpandedRows, manualPagination } = t.options
      const paginate = `${paginateExpandedRows}/${manualPagination}`
      const prev = last
      if (
        prev &&
        prev.input === input &&
        prev.expanded === expanded &&
        prev.paginate === paginate
      ) {
        return prev.output as never
      }
      const incremental =
        prev?.patchable &&
        prev.paginate === paginate &&
        expanded !== true &&
        !t.options.getIsRowExpanded &&
        input.rows.length === prev.input.rows.length &&
        Object.keys(expanded).length > 0
          ? patch(
              Object.assign(prev, {
                starts:
                  prev.starts ?? rootStarts(prev.input.rows, prev.output.rows),
              }),
              input,
              expanded,
              paginate,
            )
          : undefined
      last = incremental ?? full(input, expanded, paginate)
      return last.output as never
    }
  }
