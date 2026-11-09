/**
 * Стадия страницы движка строк (ADR 0200, §3; EN13): корни страницы вместе с ветками, как
 * модель страницы TanStack, но раскрытые строки страницы и её `flatRows` — по детям показа
 * (ADR 0200, §4), а не по `row.subRows` копий.
 */
import type { PaginationState } from '@tanstack/react-table'

import { isPaginationActive } from '../../core/dataMode'
import { passChildren } from '../../core/rowEngine/displayChildren'
import {
  type ExpandableRow,
  flattenShown,
  walkExpanded,
} from '../../shared/rowModels/expandRows'
import type { RowData, Table, TableFeatures } from '../../types'

interface PageModel {
  rows: ExpandableRow[]
  flatRows: ExpandableRow[]
  rowsById: Record<string, ExpandableRow>
}

interface PageTable {
  atoms: {
    pagination?: { get: () => PaginationState | undefined }
    expanded?: { get: () => unknown }
  }
  getPrePaginatedRowModel: () => PageModel
}

const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 10 }

const pageOf = (table: PageTable, input: PageModel): PageModel => {
  if (!input.rows.length) return input
  const { pageSize, pageIndex } =
    table.atoms.pagination?.get() ?? DEFAULT_PAGINATION
  const roots =
    pageSize !== Infinity || pageIndex !== 0
      ? input.rows.slice(pageSize * pageIndex, pageSize * pageIndex + pageSize)
      : input.rows
  let rows = roots
  // Строки показаны страницами: раскрывает страница (ADR 0169, §6).
  if (isPaginationActive(table)) {
    rows = []
    for (const row of roots) walkExpanded(input, row, rows)
  }
  const output = {
    rows,
    flatRows: flattenShown(input, rows),
    rowsById: input.rowsById,
  }
  passChildren(output, input)
  return output
}

export const createPageStage =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as PageTable
    let last:
      | {
          input: PageModel
          pagination: unknown
          expanded: unknown
          output: PageModel
        }
      | undefined
    return (read: () => unknown) => {
      const input = read() as PageModel
      const pagination = t.atoms.pagination?.get()
      const expanded = isPaginationActive(t)
        ? t.atoms.expanded?.get()
        : undefined
      if (
        last &&
        last.input === input &&
        last.pagination === pagination &&
        last.expanded === expanded
      ) {
        return last.output as never
      }
      last = { input, pagination, expanded, output: pageOf(t, input) }
      return last.output as never
    }
  }
