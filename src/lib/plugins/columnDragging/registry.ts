/**
 * Запись плагина columnDragging на `definePlugin`. Кастомная фича
 * `columnDraggingFeature` (свой слайс состояния + column-методы); порядок колонок
 * обеспечивает `columnOrderingFeature`. dnd-события — в getColumnDraggingEvents
 * (грид вызывает их).
 */
import { columnOrderingFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { ColumnDraggingComponent } from './ColumnDraggingComponent'
import {
  columnDraggingFeature,
  columnDraggingInertReason,
} from './columnDraggingFeature'
import { moveColumnKeyboardAction } from './keyboardActions'
import type { ColumnDraggingHooks } from './types'

export interface ColumnDraggingOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
  /** Бизнес-колбэк окончания переноса колонки (аргумент фабрики). */
  onColumnDragEnd?: ColumnDraggingHooks['onColumnDragEnd']
}

export const columnDragging = definePlugin<ColumnDraggingOptions>()({
  id: 'columnDragging',
  features: { columnDraggingFeature, columnOrderingFeature },
  hooks: o => ({ onColumnDragEnd: o.onColumnDragEnd }),
  keyboardActions: [moveColumnKeyboardAction],
  diagnose: columnDraggingInertReason,
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
