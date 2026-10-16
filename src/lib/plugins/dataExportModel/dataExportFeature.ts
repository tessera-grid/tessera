/**
 * Метод таблицы `table.exportData(arg?)` (ADR 0044, §7): программная выгрузка для
 * собственных кнопок потребителя.
 */
import { assignTableAPIs } from '@tanstack/react-table'

import type { RowData, TableFeature, TableFeatures } from '../../types'
import { exportByArg } from './runExport'
import type { ExportSettings } from './types'

interface DataExportTableAPI {
  /**
   * Выгрузить с настройками: объект осей (недостающие — по умолчанию), id быстрого
   * набора или без аргумента — настройки по умолчанию. Завершается с серверным `onExport`.
   */
  exportData: (arg?: string | Partial<ExportSettings>) => Promise<void>
}

/* eslint-disable @typescript-eslint/no-unused-vars -- generics карт обязаны
   повторять сигнатуры v9, иначе declaration merging не склеится */
declare module '@tanstack/react-table' {
  interface Plugins {
    dataExportFeature: TableFeature
  }
  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataExportFeature: DataExportTableAPI
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export const dataExportFeature: TableFeature = {
  constructTableAPIs: table => {
    assignTableAPIs('dataExportFeature', table, {
      table_exportData: {
        fn: (arg?: string | Partial<ExportSettings>) => exportByArg(table, arg),
      },
    })
  },
}
