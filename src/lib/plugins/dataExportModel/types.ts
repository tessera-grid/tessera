import type { BuiltInDataType, DateCellValue } from '../../core/dataTypes'
import type { RowSelectionValue } from '../../core/rowSelectionAll'

/** Значения оси «Строки» (ADR 0044, §2). */
export type ExportRows = 'all' | 'view' | 'page' | 'selected'

/** Значения оси «Колонки». */
export type ExportColumns = 'visible' | 'all'

/** Тип данных колонки, как его читает лист (ADR 0172, DT17). */
export interface ExportColumnDataType {
  name: string
  base: BuiltInDataType
  /** Значение ячейки своего формата → дата. */
  parseDate?: (value: unknown) => DateCellValue
}

export interface ExportColumn {
  id: string
  header: string
  /** Ширина колонки в гриде, px. */
  size?: number
  /** Сторона закрепления в гриде. */
  pinned?: 'start' | 'end' | false
  /** Тип данных колонки: колонки типов дат лист пишет датами. */
  dataType?: ExportColumnDataType
}

/** Данные выгрузки: колонки и строки значений в порядке колонок. */
export interface ExportData {
  columns: ExportColumn[]
  rows: unknown[][]
  /** Пояс дат таблицы (`useCreateTable({ timeZone })`, ADR 0169); без него — браузера. */
  timeZone?: string
}

export type ExportContent = string | Uint8Array | Blob

/** Контекст асинхронной выгрузки: `signal` прерывает отмена (ADR 0153, §1). */
export interface ExportContext {
  signal: AbortSignal
}

export interface ExportFormat {
  id: string
  /** Подпись формата. */
  label: string
  /** Расширение файла без точки. */
  extension: string
  mimeType: string
  /** Промис — выгрузка ждёт его, кнопка показывает ожидание (ADR 0073, §2). */
  serialize: (
    data: ExportData,
    context?: ExportContext,
  ) => ExportContent | Promise<ExportContent>
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
    /** Колонки группировки по уровням (ADR 0144); без группировки — пусто. */
    grouping: string[]
    /** Колонка → имя её `aggregationFn`; только явные строковые. */
    aggregations: Record<string, string>
  }
  selection?: RowSelectionValue
  /** Только в `onExported`. */
  rowCount?: number
  /** Только в `onExported`: имя файла без расширения. */
  filename?: string
}

export interface ExportHooks {
  /** Серверная выгрузка: её делает потребитель; промис держит кнопку занятой. */
  onExport: (
    request: ExportRequest,
    context?: ExportContext,
  ) => void | Promise<void>
  /** Файл скачан клиентом. */
  onExported: (request: ExportRequest) => void
}
