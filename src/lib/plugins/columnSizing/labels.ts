/** Подписи `columnSizing` (ADR 0182, §8): ключи словаря таблицы `columnSizing.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnSizingLabels {
  /** Accessible name of the column resize handle (`role="separator"`) */
  resizeColumn: string
  /** Width grip menu: menu name and items */
  columnWidth: string
  widenColumn: string
  narrowColumn: string
  resetColumnWidth: string
  /** Autofit width to content (ADR 0217): handle menu and kebab items */
  autosizeColumn: string
  autosizeAllColumns: string
  /** Action: cancel a resize drag */
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
