import { PluginOptions, RegistryEntry } from '../types'
import { columnSizingPlugin } from './columnSizingPlugin'
import type { ColumnSizingPlugin } from './types'

export const columnSizing = (
  opts: PluginOptions = {},
): RegistryEntry<ColumnSizingPlugin> => ({
  id: 'columnSizing',
  enabled: opts.enabled,
  feature: columnSizingPlugin,
  options: {
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  },
})
