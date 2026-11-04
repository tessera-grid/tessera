/** Подписи `dataExport` (ADR 0182, §8): ключи словаря таблицы `dataExport.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface DataExportLabels {
  /** Кнопка тулбара «Экспорт» (`export`) */
  export: string
  /** Заголовок оси «Строки» панели экспорта */
  exportRows: string
  /** Заголовок оси «Колонки» панели экспорта */
  exportColumns: string
  /** Заголовок оси «Формат» панели экспорта */
  exportFormat: string
  /** Доступное имя ряда быстрых наборов панели экспорта */
  exportPresets: string
  /** Кнопка «Выгрузить» в панели экспорта */
  exportRun: string
  /** Ось «Строки»: весь `data` в исходном порядке */
  exportAll: string
  /** Ось «Строки»: с учётом перечисленного — список из `exportViewSorting` и `exportViewFiltering` */
  exportView: (features: string[]) => string
  exportViewSorting: string
  exportViewFiltering: string
  /** Ось «Строки»: текущая страница */
  exportPage: string
  /** Ось «Строки»: выбранные строки */
  exportSelected: string
  /** Ось «Строки» при бесконечной прокрутке без серверной выгрузки: загруженные строки (ADR 0081) */
  exportLoaded: (count: number) => string
  /** Ось «Колонки»: видимые колонки */
  exportColumnsVisible: string
  /** Ось «Колонки»: все колонки, включая скрытые */
  exportColumnsAll: string
  /** Действие: выбрать формат, оси или набор выгрузки */
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
