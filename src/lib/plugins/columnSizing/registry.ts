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
      // Resize-грип — кромочный аффорданс, а не иконка-кнопка: рисуется инлайн,
      // но не учитывается в пороге схлопывания кебаба (иначе «крал» бы место).
      countsAsHeaderAction: false,
    },
  ],
  options: {
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  },
})
