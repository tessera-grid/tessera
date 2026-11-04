/** Подписи `dataExportModel` (ADR 0182, §8): ключи словаря таблицы `dataExportModel.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface DataExportModelLabels {
  /** Действие: выгрузка данных (`exportData`) */
  exportData: string
}

export const dataExportModelLabels = defineLabels<DataExportModelLabels>()(
  'dataExportModel',
  {
    exportData: 'Export',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    dataExportModel: typeof dataExportModelLabels
  }
}
