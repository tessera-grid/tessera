import { PluginOptions, RegistryEntry } from '../types'
import { groupHeaderAction } from './groupHeaderAction'
import { rowGroupingPlugin } from './rowGroupingPlugin'

export const rowGrouping = (opts: PluginOptions = {}): RegistryEntry => ({
  id: 'rowGrouping',
  enabled: opts.enabled,
  feature: rowGroupingPlugin,
  // Единый дескриптор (ADR 0016): действие группировки объявляется данными — ядро
  // решает подачу (инлайн-кнопка или строка кебаб-меню).
  slotActions: [groupHeaderAction],
  options: {
    enableGrouping: true,
    groupedColumnMode: false,
  },
})
