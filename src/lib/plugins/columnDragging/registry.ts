/**
 * Запись плагина columnDragging (ADR 0006/0022). Кастомная фича
 * columnDraggingFeature (свой слайс состояния + column-методы); порядок колонок
 * обеспечивает `columnOrderingFeature` (слот). dnd-события — в
 * getColumnDraggingEvents (грид вызывает их).
 */
import { columnOrderingFeature } from '@tanstack/react-table'

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
