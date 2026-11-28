/** Подписи `rowActions` (ADR 0182, §8): ключи словаря таблицы `rowActions.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowActionsLabels {
  /** Hidden header labels of service columns (`label` of a `ServiceColumn` entry) */
  rowActionsColumn: string
}

export const rowActionsLabels = defineLabels<RowActionsLabels>()(
  'rowActions',
  {
    rowActionsColumn: 'Actions',
  },
  {},
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowActions: typeof rowActionsLabels
  }
}
