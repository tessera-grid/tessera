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
import type { ColumnDraggingPluginParams } from './types'

export interface ColumnDraggingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк окончания переноса колонки (аргумент фабрики, ADR 0027). */
  onColumnDragEnd?: ColumnDraggingPluginParams['onColumnDragEnd']
}

export const columnDragging = (opts: ColumnDraggingOptions = {}) =>
  ({
    id: 'columnDragging',
    enabled: opts.enabled,
    slot: {
      columnDraggingFeature,
      columnOrderingFeature,
    },
    hooks: {
      columnDragging: opts.onColumnDragEnd
        ? { onColumnDragEnd: opts.onColumnDragEnd }
        : {},
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
