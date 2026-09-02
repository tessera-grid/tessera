import { PluginOptions, RegistryEntry } from '../types'
import { columnSortingPlugin } from './columnSortingPlugin'

export interface ColumnSortingOptions extends PluginOptions {
  /** Разрешить снятие сортировки третьим кликом (по умолчанию true). */
  removal?: boolean
  /** Серверная сортировка — TanStack manualSorting (по умолчанию false). */
  server?: boolean
}

export const columnSorting = (
  opts: ColumnSortingOptions = {},
): RegistryEntry => ({
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
