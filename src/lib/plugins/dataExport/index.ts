import { csvFormat } from './csv'
import { xlsxFormat } from './xlsx'

export { dataExport, type ExportOptions } from './registry'
export { csvFormat, type CsvFormatOptions } from './csv'
export { xlsxFormat, type XlsxFormatOptions } from './xlsx'
export type {
  ExportAllow,
  ExportColumn,
  ExportColumnFilter,
  ExportContent,
  ExportColumns,
  ExportData,
  ExportFormat,
  ExportHooks,
  ExportPreset,
  ExportRequest,
  ExportRows,
  ExportSettings,
  ExportValueContext,
} from './types'

/** Готовые форматы выгрузки. Объект, а не функция-фабрика: фабрики баррели — плагины. */
export const exportFormats = { csv: csvFormat, xlsx: xlsxFormat }
