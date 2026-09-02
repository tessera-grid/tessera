import { PluginOptions, RegistryEntry } from '../types'
import { rowGroupingPlugin } from './rowGroupingPlugin'

export const rowGrouping = (opts: PluginOptions = {}): RegistryEntry => ({
  id: 'rowGrouping',
  enabled: opts.enabled,
  feature: rowGroupingPlugin,
  options: {
    enableGrouping: true,
    groupedColumnMode: false,
  },
})
