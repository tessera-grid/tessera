/** Подписи `dataExportModel` (ADR 0182, §8): ключи словаря таблицы `dataExportModel.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface DataExportModelLabels {
  /** Action: export data (`exportData`) */
  exportData: string
  /** Server row model export refused: more rows than the `maxLoadedRows` limit (ADR 0190) */
  exportTooManyRows: (max: number) => string
}

export const dataExportModelLabels = defineLabels<DataExportModelLabels>()(
  'dataExportModel',
  {
    exportData: 'Export',
    exportTooManyRows: 'More than {max} rows to export',
  },
  { exportTooManyRows: ['max'] },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    dataExportModel: typeof dataExportModelLabels
  }
}
