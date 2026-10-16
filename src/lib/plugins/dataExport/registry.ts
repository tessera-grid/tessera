/**
 * Запись плагина dataExport на `definePlugin` (ADR 0044, ADR 0120): интерфейс выгрузки —
 * кнопка с панелью настроек в тулбаре (группа `data`). Модель — `dataExportModel`
 * (`table.exportData`, форматы, оси, наборы, колбэки), плагин её включает и передаёт ей
 * свои аргументы.
 */
import { definePlugin } from '../../core/definePlugin'
import {
  dataExportModel,
  dataExportModelFeatures,
  type DataExportModelOptions,
} from '../dataExportModel/registry'
import { exportInertReason } from '../dataExportModel/inertReason'
import { ExportButton } from './ExportButton'

export const EXPORT_TOOLBAR_GROUP = 'data'

export type ExportOptions = DataExportModelOptions

export const dataExport = definePlugin<ExportOptions>()({
  id: 'dataExport',
  diagnose: exportInertReason,
  model: {
    plugin: dataExportModel,
    keys: [
      'formats',
      'allow',
      'presets',
      'filename',
      'formatValue',
      'server',
      'onExport',
      'onExported',
    ],
  },
  features: dataExportModelFeatures,
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
