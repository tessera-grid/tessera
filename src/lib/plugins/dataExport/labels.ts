/** Подписи `dataExport` (ADR 0182, §8): ключи словаря таблицы `dataExport.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface DataExportLabels {
  /** The "Export" toolbar button (`export`) */
  export: string
  /** Title of the "Rows" axis of the export panel */
  exportRows: string
  /** Title of the "Columns" axis of the export panel */
  exportColumns: string
  /** Title of the "Format" axis of the export panel */
  exportFormat: string
  /** Accessible name of the export panel's preset row */
  exportPresets: string
  /** The "Export" button in the export panel */
  exportRun: string
  /** "Rows" axis: the whole `data` in source order */
  exportAll: string
  /** "Rows" axis: as shown — a list from `exportViewSorting` and `exportViewFiltering` */
  exportView: (features: string[]) => string
  exportViewSorting: string
  exportViewFiltering: string
  /** "Rows" axis: the current page */
  exportPage: string
  /** "Rows" axis: selected rows */
  exportSelected: string
  /** "Rows" axis with infinite scroll and no server export: loaded rows (ADR 0081) */
  exportLoaded: (count: number) => string
  /** "Columns" axis: visible columns */
  exportColumnsVisible: string
  /** "Columns" axis: all columns, including hidden ones */
  exportColumnsAll: string
  /** Action: choose an export format, axes or preset */
  actionChooseSettings: string
}

export const dataExportLabels = defineLabels<DataExportLabels>()(
  'dataExport',
  {
    export: 'Export',
    exportRows: 'Rows',
    exportColumns: 'Columns',
    exportFormat: 'Format',
    exportPresets: 'Quick sets',
    exportRun: 'Export',
    exportColumnsVisible: 'Visible columns',
    exportColumnsAll: 'All columns',
    exportAll: 'All rows',
    exportView: 'With {features}',
    exportViewSorting: 'sorting',
    exportViewFiltering: 'filters',
    exportPage: 'Current page',
    exportSelected: 'Selected rows',
    exportLoaded: 'Loaded rows ({count})',
    actionChooseSettings: 'Choose export settings',
  },
  {
    exportView: ['features'],
    exportLoaded: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    dataExport: typeof dataExportLabels
  }
}
