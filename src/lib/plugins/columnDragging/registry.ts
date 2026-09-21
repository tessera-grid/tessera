/**
 * Запись плагина columnDragging (ADR 0006/0022) на `definePlugin`. Кастомная фича
 * `columnDraggingFeature` (свой слайс состояния + column-методы); порядок колонок
 * обеспечивает `columnOrderingFeature`. dnd-события — в getColumnDraggingEvents
 * (грид вызывает их).
 */
import { columnOrderingFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { ColumnDraggingComponent } from './ColumnDraggingComponent'
import { columnDraggingFeature } from './columnDraggingFeature'
import type { ColumnDraggingPluginParams } from './types'

export interface ColumnDraggingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк окончания переноса колонки (аргумент фабрики, ADR 0027). */
  onColumnDragEnd?: ColumnDraggingPluginParams['onColumnDragEnd']
}

export const columnDragging = definePlugin<ColumnDraggingOptions>()({
  id: 'columnDragging',
  features: { columnDraggingFeature, columnOrderingFeature },
  hooks: o => ({ onColumnDragEnd: o.onColumnDragEnd }),
  slots: [
    {
      id: 'columnDraggingPlugin',
      slot: 'leftHeaderSlot',
      order: 0,
      component: ColumnDraggingComponent,
    },
  ],
  options: o => ({ enableColumnDragging: o.enabled !== false }),
})
