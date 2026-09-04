import { PluginOptions, RegistryEntry } from '../types'
import { columnPinningPlugin } from './columnPinningPlugin'
import type { ColumnPinningPlugin } from './types'

export const columnPinning = (
  opts: PluginOptions = {},
): RegistryEntry<ColumnPinningPlugin> => ({
  id: 'columnPinning',
  enabled: opts.enabled,
  feature: columnPinningPlugin,
  options: {
    enableColumnPinning: true,
  },
})
