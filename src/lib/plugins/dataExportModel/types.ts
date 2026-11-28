import type { BuiltInDataType, DateCellValue } from '../../core/dataTypes'
import type { RowSelectionValue } from '../../core/rowSelectionAll'

/** Values of the "Rows" axis (ADR 0044, §2). */
export type ExportRows = 'all' | 'view' | 'page' | 'selected'

/** Values of the "Columns" axis. */
export type ExportColumns = 'visible' | 'all'

/** A column's data type as the sheet reads it (ADR 0172, DT17). */
export interface ExportColumnDataType {
  name: string
  base: BuiltInDataType
  /** Custom-format cell value → date. */
  parseDate?: (value: unknown) => DateCellValue
}

export interface ExportColumn {
  id: string
  header: string
  /** Column width in the grid, px. */
  size?: number
  /** Pinning side in the grid. */
  pinned?: 'start' | 'end' | false
  /** Column data type: the sheet writes date-type columns as dates. */
  dataType?: ExportColumnDataType
}

/** Export data: columns and rows of values in column order. */
export interface ExportData {
  columns: ExportColumn[]
  rows: unknown[][]
  /** The table's time zone (`useCreateTable({ timeZone })`, ADR 0169); without it — the browser's. */
  timeZone?: string
}

export type ExportContent = string | Uint8Array | Blob

/** Context of an async export: `signal` is aborted on cancel (ADR 0153, §1). */
export interface ExportContext {
  signal: AbortSignal
}

export interface ExportFormat {
  id: string
  /** Format label. */
  label: string
  /** File extension without the dot. */
  extension: string
  mimeType: string
  /** A promise — the export waits for it, the button shows pending (ADR 0073, §2). */
  serialize: (
    data: ExportData,
    context?: ExportContext,
  ) => ExportContent | Promise<ExportContent>
}

/** Export settings: one value on each axis. */
export interface ExportSettings {
  rows: ExportRows
  columns: ExportColumns
  /** Format id from `formats`. */
  format: string
}

/** What the developer allows per axis; a value outside the list is unavailable. */
export interface ExportAllow {
  rows?: ExportRows[]
  columns?: ExportColumns[]
  /** Format ids. */
  formats?: string[]
}

/** A quick preset: sets only the listed axes and doesn't export anything. */
export interface ExportPreset extends Partial<ExportSettings> {
  id: string
  label: string
}

export interface ExportValueContext {
  value: unknown
  row: unknown
  column: { id: string }
}

/** Export request: in `onExport` — to the server, in `onExported` — the download result. */
export interface ExportRequest {
  settings: ExportSettings
  format: ExportFormat
  columns: ExportColumn[]
  /** Only for `rows: 'selected'` in server `onExport`: ids of all selected rows. */
  rowIds?: string[]
  /**
   * Server row model only, in server `onExport` (ADR 0138, §10): the result set to export and the
   * selection slice — selected `id`s or "all except". The "all except" slice also arrives without
   * the server row model — with server pagination and infinite scroll (ADR 0179, §3).
   */
  query?: {
    sorting: unknown[]
    columnFilters: unknown[]
    globalFilter: string
    /** Grouping columns by level (ADR 0144); empty without grouping. */
    grouping: string[]
    /** Column → the name of its `aggregationFn`; explicit string names only. */
    aggregations: Record<string, string>
    /** Columns with `aggregationScope: 'all'` (ADR 0229). */
    aggregationScopes: Record<string, 'all'>
  }
  selection?: RowSelectionValue
  /** Only in `onExported`. */
  rowCount?: number
  /** Only in `onExported`: file name without extension. */
  filename?: string
}

export interface ExportHooks {
  /** Server export: the consumer performs it; a promise keeps the button busy. */
  onExport: (
    request: ExportRequest,
    context?: ExportContext,
  ) => void | Promise<void>
  /** The file was downloaded by the client. */
  onExported: (request: ExportRequest) => void
}
