/** Подписи `columnSizing` (ADR 0182, §8): ключи словаря таблицы `columnSizing.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnSizingLabels {
  /** Доступное имя ручки изменения ширины колонки (`role="separator"`) */
  resizeColumn: string
  /** Меню грипа ширины: имя меню и пункты */
  columnWidth: string
  widenColumn: string
  narrowColumn: string
  resetColumnWidth: string
  /** Автоподбор ширины по содержимому (ADR 0217): пункты меню ручки и кебаба */
  autosizeColumn: string
  autosizeAllColumns: string
  /** Действие: отмена протяжки */
  actionResizeCancel: string
}

export const columnSizingLabels = defineLabels<ColumnSizingLabels>()(
  'columnSizing',
  {
    resizeColumn: 'Resize column',
    columnWidth: 'Column width',
    widenColumn: 'Wider',
    narrowColumn: 'Narrower',
    resetColumnWidth: 'Reset width',
    autosizeColumn: 'Autosize column',
    autosizeAllColumns: 'Autosize all columns',
    actionResizeCancel: 'Cancel resizing',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnSizing: typeof columnSizingLabels
  }
}
