import { PluginOptions, RegistryEntry, ServiceColumn } from '../types'
import {
  COLUMN_EXPANDING_ID,
  getRowExpandingColumn,
} from './rowExpandingColumn'
import {
  DEFAULT_MAX_EXPANDING_DEPTH,
  rowExpandingPlugin,
} from './rowExpandingPlugin'
import type { RowExpandingPlugin } from './types'

export interface RowExpandingOptions extends PluginOptions {
  /** Максимальная глубина раскрытия (по умолчанию DEFAULT_MAX_EXPANDING_DEPTH). */
  maxDepth?: number
}

export const rowExpanding = (
  opts: RowExpandingOptions = {},
): RegistryEntry<RowExpandingPlugin> => ({
  id: 'rowExpanding',
  enabled: opts.enabled,
  feature: rowExpandingPlugin,
  column: {
    id: COLUMN_EXPANDING_ID,
    make: getRowExpandingColumn as ServiceColumn['make'],
    side: 'leading',
    order: 2,
    pin: { side: 'left', when: 'with-user' },
  },
  options: {
    enableRowExpanding: true,
    autoResetExpanded: false,
    maxExpandingDepth: opts.maxDepth ?? DEFAULT_MAX_EXPANDING_DEPTH,
  },
})
