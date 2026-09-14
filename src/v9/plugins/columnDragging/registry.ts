/**
 * Фаза E — запись плагина columnDragging для v9 (порт registry.ts, ADR 0006/0022).
 *
 * Отличия от v8:
 *  - кастомная фича columnDraggingFeature (свой слайс состояния + column-методы);
 *    порядок колонок обеспечивает `columnOrderingFeature` (слот);
 *  - `keepFeatureWhenDisabled` не нужен (в v9 нет фиксации фич «на маунте»);
 *  - dnd-события — в getColumnDraggingEvents (грид вызывает на cutover).
 */
import { columnOrderingFeature } from '@tanstack/table-v9'

import type { TesseraFeatureEntry } from '../../core/features'
import { ColumnDraggingComponent } from './ColumnDraggingComponent'
import { columnDraggingFeature } from './columnDraggingFeature'

export interface ColumnDraggingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

export const columnDragging = (opts: ColumnDraggingOptions = {}) =>
  ({
    id: 'columnDragging',
    enabled: opts.enabled,
    slot: {
      columnDraggingFeature,
      columnOrderingFeature,
    },
    slots: [
      {
        id: 'columnDraggingPlugin',
        slot: 'leftHeaderSlot',
        order: 0,
        component: ColumnDraggingComponent,
      },
    ],
    options: {
      enableColumnDragging: opts.enabled !== false,
    },
  }) satisfies TesseraFeatureEntry<{
    columnDraggingFeature: typeof columnDraggingFeature
    columnOrderingFeature: typeof columnOrderingFeature
  }>
