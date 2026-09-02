import { PluginOptions, RegistryEntry } from '../types'
import { columnPinningPlugin } from './columnPinningPlugin'

export const columnPinning = (opts: PluginOptions = {}): RegistryEntry => ({
  id: 'columnPinning',
  enabled: opts.enabled,
  feature: columnPinningPlugin,
  options: {
    enableColumnPinning: true,
  },
})
