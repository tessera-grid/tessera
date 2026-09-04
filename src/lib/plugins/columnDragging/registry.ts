import { PluginOptions, RegistryEntry } from '../types'
import { columnDraggingPlugin } from './columnDraggingPlugin'
import type { ColumnDraggingPlugin } from './types'

export const columnDragging = (
  opts: PluginOptions = {},
): RegistryEntry<ColumnDraggingPlugin> => ({
  id: 'columnDragging',
  enabled: opts.enabled,
  feature: columnDraggingPlugin,
  options: {
    enableColumnDragging: true,
  },
})
