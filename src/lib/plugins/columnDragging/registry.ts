import { PluginOptions, RegistryEntry } from '../types'
import { columnDraggingPlugin } from './columnDraggingPlugin'

export const columnDragging = (opts: PluginOptions = {}): RegistryEntry => ({
  id: 'columnDragging',
  enabled: opts.enabled,
  feature: columnDraggingPlugin,
  options: {
    enableColumnDragging: true,
  },
})
