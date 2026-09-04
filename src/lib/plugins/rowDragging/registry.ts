import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'
import { COLUMN_DRAGGING_ID, getRowDraggingColumn } from './rowDraggingColumn'
import { rowDraggingPlugin } from './rowDraggingPlugin'
import type { RowDraggingPlugin } from './types'

export const rowDragging = (
  opts: PluginOptions = {},
): RegistryEntry<RowDraggingPlugin> => ({
  id: 'rowDragging',
  enabled: opts.enabled,
  feature: rowDraggingPlugin,
  column: {
    id: COLUMN_DRAGGING_ID,
    make: getRowDraggingColumn as ServiceColumn['make'],
    side: 'leading',
    order: 0,
    pin: { side: 'left', when: 'with-user' },
  },
  options: {
    enableRowDragging: true,
  },
})
