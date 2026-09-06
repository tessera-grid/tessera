import { ColumnPinningComponent } from './ColumnPinningComponent'
import { PluginOptions, RegistryEntry } from '../types'
import { columnPinningPlugin } from './columnPinningPlugin'
import type { ColumnPinningPlugin } from './types'

export const columnPinning = (
  opts: PluginOptions = {},
): RegistryEntry<ColumnPinningPlugin> => ({
  id: 'columnPinning',
  enabled: opts.enabled,
  // Фича оборачивает getCanPin, ограничивая пиннинг одноуровневой шапкой. Держим
  // её в _features всегда: иначе при live-включении обёртки нет, и кнопки пиннинга
  // появляются на сгруппированных шапках, где пиннинг ломает раскладку. Пока опция
  // выключена (enableColumnPinning: false), базовый getCanPin возвращает false —
  // обёртка инертна.
  keepFeatureWhenDisabled: true,
  feature: columnPinningPlugin,
  slots: [
    {
      id: 'columnPinningPlugin',
      slot: 'rightHeaderSlot',
      order: 0,
      component: ColumnPinningComponent,
    },
  ],
  options: {
    enableColumnPinning: true,
  },
})
