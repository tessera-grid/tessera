import { csvFormat } from '../dataExportModel/csv'
import { xlsxFormat } from '../dataExportModel/xlsx'

export { dataExport, type ExportOptions } from './registry'
export { csvFormat, type CsvFormatOptions } from '../dataExportModel/csv'
export { xlsxFormat, type XlsxFormatOptions } from '../dataExportModel/xlsx'
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
} from '../dataExportModel/types'

/** Готовые форматы выгрузки. Объект, а не функция-фабрика: фабрики баррели — плагины. */
export const exportFormats = { csv: csvFormat, xlsx: xlsxFormat }
