import { ColumnSizingComponent } from './ColumnSizingComponent'
import { PluginOptions, RegistryEntry } from '../types'
import { columnSizingPlugin } from './columnSizingPlugin'
import type { ColumnSizingPlugin } from './types'

export const columnSizing = (
  opts: PluginOptions = {},
): RegistryEntry<ColumnSizingPlugin> => ({
  id: 'columnSizing',
  enabled: opts.enabled,
  feature: columnSizingPlugin,
  slots: [
    {
      id: 'columnSizingPlugin',
      slot: 'rightHeaderSlot',
      order: 'last',
      component: ColumnSizingComponent,
    },
  ],
  options: {
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  },
})
