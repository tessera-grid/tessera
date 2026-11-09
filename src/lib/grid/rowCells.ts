/**
 * Ячейки строки для тела (ADR 0200, EN14): ячейка создаётся, когда тело её рисует, а не все
 * видимые ячейки строки разом, как у `row.getVisibleCells()`. На тысяче колонок строка
 * создаёт ячейки только окна колонок.
 */
import { constructCell } from '@tanstack/react-table'

import { getDisplayColumns } from '../core/displayColumns'
import type { Cell, Column, Row } from '../types'

/** Ячейки строки в порядке отображения: индекс — как у `row.getVisibleCells()`. */
export interface RowCells {
  at: (index: number) => Cell<any, any, unknown>
  /** Колонка последней ячейки строки. */
  lastColumn: () => Column<any, any, unknown> | undefined
}

/** Ячейка строки по колонке: та же, пока живы строка и колонка. */
const cellsByColumn = new WeakMap<
  object,
  WeakMap<object, Cell<any, any, unknown>>
>()

/** Ячейки строки на набор колонок отображения: тот же объект, пока набор тот же. */
const rowCells = new WeakMap<object, { columns: object; cells: RowCells }>()

export const rowCellsOf = (table: object, row: Row<any, any>): RowCells => {
  const { columns } = getDisplayColumns(
    table as Parameters<typeof getDisplayColumns<Column<any, any, unknown>>>[0],
  )
  const cached = rowCells.get(row)
  if (cached?.columns === columns) return cached.cells
  let byColumn = cellsByColumn.get(row)
  if (!byColumn) {
    byColumn = new WeakMap()
    cellsByColumn.set(row, byColumn)
  }
  const known = byColumn
  const cells: RowCells = {
    at: index => {
      const column = columns[index]!
      let cell = known.get(column)
      if (!cell) {
        cell = constructCell(
          column as never,
          row as never,
          table as never,
        ) as unknown as Cell<any, any, unknown>
        known.set(column, cell)
      }
      return cell
    },
    lastColumn: () => columns.at(-1),
  }
  rowCells.set(row, { columns, cells })
  return cells
}
