import { csvFormat } from '../dataExportModel/csv'
import { xlsxFormat } from '../dataExportModel/xlsx'

export { dataExport, type ExportOptions } from './registry'
export { csvFormat, type CsvFormatOptions } from '../dataExportModel/csv'
export { xlsxFormat, type XlsxFormatOptions } from '../dataExportModel/xlsx'
export type {
  ExportAllow,
  ExportColumn,
  ExportColumnDataType,
  ExportContent,
  ExportContext,
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

/** Ready-made export formats. An object, not a factory function: the barrel's factories are plugins. */
export const exportFormats: {
  csv: typeof csvFormat
  xlsx: typeof xlsxFormat
} = { csv: csvFormat, xlsx: xlsxFormat }
