/**
 * Запись плагина dataExportModel на `definePlugin`: выгрузка без интерфейса (ADR 0044,
 * ADR 0120) — метод `table.exportData` для своих кнопок приложения, форматы, имя файла,
 * значения, разрешённые оси и быстрые наборы, серверный режим и колбэки выгрузки.
 * Кнопка с панелью настроек в тулбаре — у `dataExport`, который включает эту модель.
 */
import type { RowData, TableFeatures } from '@tanstack/react-table'
import { definePlugin } from '../../core/definePlugin'
import { csvFormat } from './csv'
import { dataExportFeature } from './dataExportFeature'
import { exportInertReason } from './inertReason'
import type { ResolvedExportOptions } from './settings'
import type {
  ExportAllow,
  ExportFormat,
  ExportHooks,
  ExportPreset,
  ExportSettings,
  ExportValueContext,
} from './types'
import { dataExportModelLabels } from './labels'

const DEFAULT_FORMATS = [csvFormat()]

export interface DataExportModelOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Export formats; one CSV by default. */
  formats?: ExportFormat[]
  /** What is allowed per axis (rows, columns, formats); the rest is unavailable. */
  allow?: ExportAllow
  /** Quick setting presets: `table.exportData(id)` and the panel buttons. */
  presets?: ExportPreset[]
  /** File name without extension (`export` by default). */
  filename?:
    string | ((settings: ExportSettings, format: ExportFormat) => string)
  /** Overrides a cell's value in the export. */
  formatValue?: (context: ExportValueContext) => unknown
  /**
   * Server export (`dataMode.export`, ADR 0169): the consumer performs it; a promise keeps the
   * export pending.
   */
  onExport?: ExportHooks['onExport']
  /** The file was downloaded by the client. */
  onExported?: ExportHooks['onExported']
  /** Limit of rows the export loads from the server row model (10,000 by default). */
  maxLoadedRows?: number
}

/** Фичи модели выгрузки; интерфейс несёт те же — по ним выводится тип API. */
export const dataExportModelFeatures = { dataExportFeature }

export const dataExportModel = definePlugin<DataExportModelOptions>()({
  id: 'dataExportModel',
  labels: [dataExportModelLabels],
  actions: {
    exportData: labels => dataExportModelLabels(labels).exportData,
  },
  diagnose: exportInertReason,
  features: dataExportModelFeatures,
  hooks: o => ({ onExport: o.onExport, onExported: o.onExported }),
  options: o => ({
    exportOptions: {
      formats: o.formats ?? DEFAULT_FORMATS,
      allow: o.allow,
      presets: o.presets,
      filename: o.filename,
      formatValue: o.formatValue,
      maxLoadedRows: o.maxLoadedRows,
    } satisfies ResolvedExportOptions,
  }),
})

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    /** Опции таблицы, которые выставляет плагин (ADR 0167). */
    dataExportModelPlugin: {
      exportOptions?: ResolvedExportOptions
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
