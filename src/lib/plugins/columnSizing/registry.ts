import { PluginOptions, RegistryEntry } from '../types'
import { columnSizingPlugin } from './columnSizingPlugin'

export const columnSizing = (opts: PluginOptions = {}): RegistryEntry => ({
  id: 'columnSizing',
  enabled: opts.enabled,
  feature: columnSizingPlugin,
  options: {
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  },
})
