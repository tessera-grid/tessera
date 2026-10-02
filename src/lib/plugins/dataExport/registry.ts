/**
 * Запись плагина dataExport на `definePlugin` (ADR 0044). Кнопка с панелью настроек в
 * тулбаре (группа `data`), метод `table.exportData`, опции выгрузки — в опциях таблицы,
 * колбэки — в хуках.
 */
import { definePlugin } from '../../core/definePlugin'
import { csvFormat } from './csv'
import { dataExportFeature } from './dataExportFeature'
import { ExportButton } from './ExportButton'
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

export const EXPORT_TOOLBAR_GROUP = 'data'

const DEFAULT_FORMATS = [csvFormat()]

export interface ExportOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Форматы выгрузки; по умолчанию один CSV. */
  formats?: ExportFormat[]
  /** Что разрешено по осям (строки, колонки, форматы); остальное в панели недоступно. */
  allow?: ExportAllow
  /** Быстрые наборы настроек в панели: клик выставляет оси, но не выгружает. */
  presets?: ExportPreset[]
  /** Имя файла без расширения (по умолчанию `export`). */
  filename?:
    string | ((settings: ExportSettings, format: ExportFormat) => string)
  /** Переопределяет значение ячейки в выгрузке. */
  formatValue?: (context: ExportValueContext) => unknown
  /** Полного набора строк на клиенте нет: все значения строк, кроме `page`, выполняет сервер. */
  server?: boolean
  /** Серверная выгрузка: её делает потребитель; промис держит кнопку занятой. */
  onExport?: ExportHooks['onExport']
  /** Файл скачан клиентом. */
  onExported?: ExportHooks['onExported']
}

export const dataExport = definePlugin<ExportOptions>()({
  id: 'dataExport',
  // Режим выгрузки — договор с потребителем на время жизни таблицы (ADR 0039).
  lifetime: ['server'],
  diagnose: exportInertReason,
  features: { dataExportFeature },
  hooks: o => ({ onExport: o.onExport, onExported: o.onExported }),
  options: o => ({
    exportOptions: {
      formats: o.formats ?? DEFAULT_FORMATS,
      allow: o.allow,
      presets: o.presets,
      filename: o.filename,
      formatValue: o.formatValue,
      server: o.server,
    } satisfies ResolvedExportOptions,
  }),
  slots: [
    {
      id: 'exportButton',
      slot: 'toolbarSlot',
      group: EXPORT_TOOLBAR_GROUP,
      order: 0,
      component: ExportButton,
    },
  ],
})
