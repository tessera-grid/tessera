/**
 * Запись плагина columnSizing (ADR 0013). Sizing и resizing — две отдельные фичи
 * ядра; ресайз требует размеров, поэтому слот несёт обе: `columnSizingFeature` +
 * `columnResizingFeature` (prereq проверяется типами).
 */
import {
  columnResizingFeature,
  columnSizingFeature,
} from '@tanstack/react-table'

import type { TesseraFeatureEntry } from '../../core/features'
import { ColumnSizingComponent } from './ColumnSizingComponent'
import type { ColumnSizingPluginParams } from './types'

export interface ColumnSizingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк окончания ресайза (аргумент фабрики, ADR 0027); читается живо. */
  onColumnResizeEnd?: ColumnSizingPluginParams['onColumnResizeEnd']
}

export const columnSizing = (opts: ColumnSizingOptions = {}) =>
  ({
    id: 'columnSizing',
    enabled: opts.enabled,
    slot: {
      columnSizingFeature,
      columnResizingFeature,
    },
    hooks: {
      columnSizing: opts.onColumnResizeEnd
        ? { onColumnResizeEnd: opts.onColumnResizeEnd }
        : {},
    },
    slots: [
      {
        id: 'columnSizingPlugin',
        slot: 'rightHeaderSlot',
        order: 'last',
        component: ColumnSizingComponent,
        // Resize-грип — кромочный аффорданс, а не иконка-кнопка: инлайн, но НЕ
        // учитывается в пороге схлопывания кебаба (иначе «крал» бы место).
        countsAsHeaderAction: false,
      },
    ],
    options: {
      enableColumnResizing: opts.enabled !== false,
      columnResizeMode: 'onChange',
    },
  }) satisfies TesseraFeatureEntry<{
    columnSizingFeature: typeof columnSizingFeature
    columnResizingFeature: typeof columnResizingFeature
  }>
