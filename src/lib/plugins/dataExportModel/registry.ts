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
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Форматы выгрузки; по умолчанию один CSV. */
  formats?: ExportFormat[]
  /** Что разрешено по осям (строки, колонки, форматы); остальное недоступно. */
  allow?: ExportAllow
  /** Быстрые наборы настроек: `table.exportData(id)` и кнопки панели. */
  presets?: ExportPreset[]
  /** Имя файла без расширения (по умолчанию `export`). */
  filename?:
    string | ((settings: ExportSettings, format: ExportFormat) => string)
  /** Переопределяет значение ячейки в выгрузке. */
  formatValue?: (context: ExportValueContext) => unknown
  /**
   * Серверная выгрузка (`dataMode.export`, ADR 0169): её делает потребитель; промис держит
   * выгрузку в ожидании.
   */
  onExport?: ExportHooks['onExport']
  /** Файл скачан клиентом. */
  onExported?: ExportHooks['onExported']
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
