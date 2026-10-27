/**
 * Сбор данных выгрузки из таблицы (ADR 0044, §2–§3): колонки в порядке отображения,
 * строки по охвату пресета, значения ячеек, а не их отрисовка; у колонок с вариантами
 * — подписи (ADR 0048, §4).
 */
import { type ColumnOptionsDef, optionTextOf } from '../../core/columnOptions'
import { serverRowModelReason } from '../../core/pluginDiagnostics'
import { rowSourceOf } from '../../core/rowSource'
import { rowSelectionValueOf } from '../../core/rowSelectionAll'
import { serverAggregationsOf } from '../../core/serverAggregations'
import type {
  ExportColumn,
  ExportData,
  ExportRequest,
  ExportRows,
  ExportValueContext,
} from './types'

export interface ExportCollectOptions {
  rows?: ExportRows
  columns?: 'visible' | 'all'
  formatValue?: (context: ExportValueContext) => unknown
}

interface ExportRow {
  id: string
  getValue: (columnId: string) => unknown
  getIsGrouped?: () => boolean
  getIsSelected?: () => boolean
  subRows?: ExportRow[]
}

interface ExportSourceColumn {
  id: string
  columnDef: { header?: unknown; filter?: unknown } & ColumnOptionsDef
  getIsVisible: () => boolean
  getSize?: () => number
  getIsActionsColumn?: () => boolean
  getIsPinned?: () => false | 'start' | 'end'
}

type RowModel = { rows: ExportRow[] }

interface ExportTable {
  getAllLeafColumns: () => ExportSourceColumn[]
  getCoreRowModel: () => RowModel
  getRowModel: () => RowModel
  getPreExpandedRowModel?: () => RowModel
  getPrePaginatedRowModel?: () => RowModel
  options?: { columnFilteringTimeZone?: string }
}

const PIN_ORDER = { start: 0, center: 1, end: 2 } as const

/** Значение → текст: null → пусто, Date → ISO, объект → JSON. */
export const toExportText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const exportColumnsOf = (
  table: unknown,
  scope: 'visible' | 'all' = 'visible',
): ExportSourceColumn[] =>
  (table as ExportTable)
    .getAllLeafColumns()
    .filter(
      column =>
        !column.getIsActionsColumn?.() &&
        (scope === 'all' || column.getIsVisible()),
    )
    .map((column, index) => ({
      column,
      index,
      side: PIN_ORDER[column.getIsPinned?.() || 'center'],
    }))
    .sort((a, b) => a.side - b.side || a.index - b.index)
    .map(({ column }) => column)

export const headerOf = (column: ExportSourceColumn): string =>
  typeof column.columnDef.header === 'string'
    ? column.columnDef.header
    : column.id

/** Данные в глубину по `subRows`; строки-группы пропускаются, их дети — нет. */
const walk = (rows: ExportRow[], visit: (row: ExportRow) => void) => {
  for (const row of rows) {
    if (!row.getIsGrouped?.()) visit(row)
    if (row.subRows?.length) walk(row.subRows, visit)
  }
}

/** Модель до раскрытия и нарезки: после сортировки (и группировки), все страницы. */
const viewRows = (table: ExportTable): ExportRow[] =>
  (
    table.getPreExpandedRowModel ??
    table.getPrePaginatedRowModel ??
    table.getRowModel
  ).call(table).rows

export const exportRowsOf = (
  table: unknown,
  scope: ExportRows,
): ExportRow[] => {
  const source = table as ExportTable
  const out: ExportRow[] = []
  const push = (row: ExportRow) => out.push(row)

  if (scope === 'all') {
    walk(source.getCoreRowModel().rows, push)
  } else if (scope === 'page') {
    // Строки страницы уже плоские (раскрытые дети — отдельные строки): без обхода.
    const rows = rowSourceOf<ExportRow>(table)
    for (let index = 0; index < rows.count(); index++) {
      const row = rows.at(index)
      if (row && !row.getIsGrouped?.()) push(row)
    }
  } else {
    walk(viewRows(source), row => {
      if (scope === 'view' || row.getIsSelected?.()) push(row)
    })
    // Выбранные, но скрытые фильтром — после видимых, в порядке данных (ADR 0045, FL25).
    if (scope === 'selected') {
      const included = new Set(out.map(row => row.id))
      walk(source.getCoreRowModel().rows, row => {
        if (row.getIsSelected?.() && !included.has(row.id)) push(row)
      })
    }
  }
  return out
}

/** Id выбранных строк из среза `rowSelection` — по всем страницам, в том числе не загруженным. */
/**
 * Серверная модель строк (ADR 0138, §10): серверу нужна выборка и срез выбора, строк у
 * грида нет. Без неё — пусто.
 */
export const serverRowsRequestOf = (
  table: unknown,
): Pick<ExportRequest, 'query' | 'selection'> => {
  if (!serverRowModelReason(table)) return {}
  const state = (
    table as { store: { get: () => Record<string, unknown> } }
  ).store.get()
  return {
    query: {
      sorting: (state.sorting ?? []) as unknown[],
      columnFilters: (state.columnFilters ?? []) as unknown[],
      globalFilter: (state.globalFilter ?? '') as string,
      grouping: (state.grouping ?? []) as string[],
      aggregations: serverAggregationsOf(table),
    },
    selection: rowSelectionValueOf(table),
  }
}

export const selectedRowIdsOf = (table: unknown): string[] => {
  const selection = (
    table as {
      atoms?: { rowSelection?: { get: () => Record<string, boolean> } }
    }
  ).atoms?.rowSelection?.get()
  return Object.entries(selection ?? {})
    .filter(([, selected]) => selected)
    .map(([id]) => id)
}

export const collectExportData = (
  table: unknown,
  { rows = 'all', columns = 'visible', formatValue }: ExportCollectOptions = {},
): ExportData => {
  const leaves = exportColumnsOf(table, columns)
  const exportColumns: ExportColumn[] = leaves.map(column => ({
    id: column.id,
    header: headerOf(column),
    size: column.getSize?.(),
    pinned: column.getIsPinned?.() ?? false,
    ...(column.columnDef.filter !== undefined
      ? { filter: column.columnDef.filter as ExportColumn['filter'] }
      : {}),
  }))
  const timeZone = (table as ExportTable).options?.columnFilteringTimeZone
  return {
    columns: exportColumns,
    ...(timeZone ? { timeZone } : {}),
    rows: exportRowsOf(table, rows).map(row =>
      leaves.map(column => {
        const value = row.getValue(column.id)
        return formatValue
          ? formatValue({ value, row, column })
          : (optionTextOf(table as object, column, value) ?? value)
      }),
    ),
  }
}
