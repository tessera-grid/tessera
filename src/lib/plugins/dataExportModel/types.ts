import type { RowSelectionValue } from '../../core/rowSelectionAll'

/** Значения оси «Строки» (ADR 0044, §2). */
export type ExportRows = 'all' | 'view' | 'page' | 'selected'

/** Значения оси «Колонки». */
export type ExportColumns = 'visible' | 'all'

/** Поле `filter` колонки, как его читает лист: тип и разбор даты (ADR 0073, §3). */
export type ExportColumnFilter =
  string | { type?: string; parse?: (value: unknown) => unknown }

export interface ExportColumn {
  id: string
  header: string
  /** Ширина колонки в гриде, px. */
  size?: number
  /** Сторона закрепления в гриде. */
  pinned?: 'start' | 'end' | false
  /** `columnDef.filter`: колонки `date` / `datetime` лист пишет датами. */
  filter?: ExportColumnFilter
}

/** Данные выгрузки: колонки и строки значений в порядке колонок. */
export interface ExportData {
  columns: ExportColumn[]
  rows: unknown[][]
  /** Пояс дат грида (`columnFiltering({ timeZone })`); без него — браузера. */
  timeZone?: string
}

export type ExportContent = string | Uint8Array | Blob

export interface ExportFormat {
  id: string
  /** Подпись формата. */
  label: string
  /** Расширение файла без точки. */
  extension: string
  mimeType: string
  /** Промис — выгрузка ждёт его, кнопка показывает ожидание (ADR 0073, §2). */
  serialize: (data: ExportData) => ExportContent | Promise<ExportContent>
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
  /**
   * Только серверная модель строк, в серверном `onExport` (ADR 0138, §10): выборка, под
   * которую выгружать, и срез выбора — выбранные `id` или «всё, кроме».
   */
  query?: {
    sorting: unknown[]
    columnFilters: unknown[]
    globalFilter: string
  }
  selection?: RowSelectionValue
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
