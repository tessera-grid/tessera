/** Подписи `rowExpanding` (ADR 0182, §8): ключи словаря таблицы `rowExpanding.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface RowExpandingLabels {
  /** Name and tooltip of the expand button on a collapsed row (ADR 0015, RE13) */
  expandRow: string
  /** Name and tooltip of the expand button on an expanded row */
  collapseRow: string
  /** Name and tooltip of the button in the expand column header when some rows are collapsed (ADR 0160) */
  expandAll: string
  /** Name and tooltip of the same button when everything is expanded */
  collapseAll: string
  /** Failure text of loading a row's children when the server sent none (ADR 0054) */
  loadChildrenFailed: string
  /** Announcement that expanding a row failed */
  announceExpandFailed: (error: string) => string
  /** Announcement of a row's children arriving asynchronously (`0` — an empty answer, ADR 0056) */
  announceChildrenLoaded: (count: number) => string
  /** Hidden header labels of service columns (`label` of a `ServiceColumn` entry) */
  expandColumn: string
  /** Action: expand or collapse a row */
  actionToggleRow: string
}

export const rowExpandingLabels = defineLabels<RowExpandingLabels>()(
  'rowExpanding',
  {
    expandRow: 'Expand row',
    collapseRow: 'Collapse row',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    loadChildrenFailed: 'Unknown error',
    announceExpandFailed: "Couldn't load: {error}",
    announceChildrenLoaded: 'Loaded {count} rows',
    announceChildrenLoaded_one: 'Loaded {count} row',
    announceChildrenLoaded_zero: 'No rows',
    expandColumn: 'Expand',
    actionToggleRow: 'Expand or collapse a row',
  },
  {
    announceExpandFailed: ['error'],
    announceChildrenLoaded: ['count'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    rowExpanding: typeof rowExpandingLabels
  }
}
