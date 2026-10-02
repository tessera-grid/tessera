/** Значения оси «Строки» (ADR 0044, §2). */
export type ExportRows = 'all' | 'view' | 'page' | 'selected'

/** Значения оси «Колонки». */
export type ExportColumns = 'visible' | 'all'

export interface ExportColumn {
  id: string
  header: string
}

/** Данные выгрузки: колонки и строки значений в порядке колонок. */
export interface ExportData {
  columns: ExportColumn[]
  rows: unknown[][]
}

export interface ExportFormat {
  id: string
  /** Подпись формата. */
  label: string
  /** Расширение файла без точки. */
  extension: string
  mimeType: string
  serialize: (data: ExportData) => string | Uint8Array | Blob
}

/** Настройки выгрузки: по одному значению в каждой оси. */
export interface ExportSettings {
  rows: ExportRows
  columns: ExportColumns
  /** Id формата из `formats`. */
  format: string
}

/** Что разрешено разработчиком по осям; значение вне списка недоступно. */
export interface ExportAllow {
  rows?: ExportRows[]
  columns?: ExportColumns[]
  /** Id форматов. */
  formats?: string[]
}

/** Быстрый набор: выставляет только перечисленные оси и ничего не выгружает. */
export interface ExportPreset extends Partial<ExportSettings> {
  id: string
  label: string
}

export interface ExportValueContext {
  value: unknown
  row: unknown
  column: { id: string }
}

/** Запрос выгрузки: в `onExport` — на сервер, в `onExported` — итог скачивания. */
export interface ExportRequest {
  settings: ExportSettings
  format: ExportFormat
  columns: ExportColumn[]
  /** Только `rows: 'selected'` в серверном `onExport`: id всех выбранных строк. */
  rowIds?: string[]
  /** Только в `onExported`. */
  rowCount?: number
  /** Только в `onExported`: имя файла без расширения. */
  filename?: string
}

export interface ExportHooks {
  /** Серверная выгрузка: её делает потребитель; промис держит кнопку занятой. */
  onExport: (request: ExportRequest) => void | Promise<void>
  /** Файл скачан клиентом. */
  onExported: (request: ExportRequest) => void
}
