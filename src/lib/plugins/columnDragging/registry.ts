import { ColumnDraggingComponent } from './ColumnDraggingComponent'
import { PluginOptions, RegistryEntry } from '../types'
import { columnDraggingPlugin } from './columnDraggingPlugin'
import type { ColumnDraggingPlugin } from './types'

export const columnDragging = (
  opts: PluginOptions = {},
): RegistryEntry<ColumnDraggingPlugin> => ({
  id: 'columnDragging',
  enabled: opts.enabled,
  // Фича вешает на колонку getCanDrag/getDraggableIndex, которые реактивный UI
  // (слот ручки, DraggableHeadCell) зовёт при live-включении. Держим её в
  // _features всегда, иначе метода не будет на маунте с выключенным плагином.
  keepFeatureWhenDisabled: true,
  feature: columnDraggingPlugin,
  slots: [
    {
      id: 'columnDraggingPlugin',
      slot: 'leftHeaderSlot',
      order: 0,
      component: ColumnDraggingComponent,
    },
  ],
  options: {
    enableColumnDragging: true,
  },
})
