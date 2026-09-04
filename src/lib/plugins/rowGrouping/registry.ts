import { RowGroupingComponent } from './RowGroupingComponent'
import { PluginOptions, RegistryEntry } from '../types'
import { rowGroupingPlugin } from './rowGroupingPlugin'

export const rowGrouping = (opts: PluginOptions = {}): RegistryEntry => ({
  id: 'rowGrouping',
  enabled: opts.enabled,
  feature: rowGroupingPlugin,
  slots: [
    {
      id: 'rowGroupingPlugin',
      slot: 'rightHeaderSlot',
      order: 1,
      component: RowGroupingComponent,
    },
  ],
  options: {
    enableGrouping: true,
    groupedColumnMode: false,
  },
})
