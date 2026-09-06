import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'
import {
  COLUMN_SELECTION_ID,
  getRowSelectionColumn,
} from './rowSelectionColumn'
import { rowSelectionPlugin } from './rowSelectionPlugin'
import type { RowSelectionPlugin } from './types'

export interface RowSelectionOptions extends PluginOptions {
  /** Разрешить выбор дочерних строк (каскад на поддерево). */
  subRows?: boolean
}

export const rowSelection = (
  opts: RowSelectionOptions = {},
): RegistryEntry<RowSelectionPlugin> => ({
  id: 'rowSelection',
  enabled: opts.enabled,
  feature: rowSelectionPlugin,
  column: {
    id: COLUMN_SELECTION_ID,
    make: getRowSelectionColumn as ServiceColumn['make'],
    side: 'leading',
    order: 1,
    pin: { side: 'left', when: 'with-user' },
  },
  options: {
    enableRowSelection: true,
    enableSubRowSelection: opts.subRows ?? false,
  },
})
