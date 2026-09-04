import { PluginOptions, RegistryEntry } from '../types'
import { columnSortingPlugin } from './columnSortingPlugin'
import type { ColumnSortingPlugin } from './types'

export interface ColumnSortingOptions extends PluginOptions {
  /** Разрешить снятие сортировки третьим кликом (по умолчанию true). */
  removal?: boolean
  /** Серверная сортировка — TanStack manualSorting (по умолчанию false). */
  server?: boolean
}

export const columnSorting = (
  opts: ColumnSortingOptions = {},
): RegistryEntry<ColumnSortingPlugin> => ({
  id: 'columnSorting',
  enabled: opts.enabled,
  feature: columnSortingPlugin,
  options: {
    enableSorting: true,
    enableSortingRemoval: opts.removal ?? true,
    manualSorting: opts.server ?? false,
    sortDescFirst: true,
  },
})
