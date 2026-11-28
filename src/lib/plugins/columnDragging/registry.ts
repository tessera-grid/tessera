/**
 * Запись плагина columnDragging на `definePlugin`. Кастомная фича
 * `columnDraggingFeature` (свой слайс состояния + column-методы); порядок колонок
 * обеспечивает `columnOrderingFeature`. dnd-события — в getColumnDraggingEvents
 * (их зовёт обёртка шапки плагина, ADR 0168).
 */
import { columnOrderingFeature } from '@tanstack/react-table'

import { definePlugin } from '../../core/definePlugin'
import { withWrappers } from '../../core/pluginWrappers'
import { HeadBoundary } from './HeadBoundary'
import { HeadSeries } from './HeadSeries'
import { SortableHeadCell } from './SortableHeadCell'
import { ColumnDraggingComponent } from './ColumnDraggingComponent'
import { columnDraggingFeature } from './columnDraggingFeature'
import { neverInert } from '../../core/pluginDiagnostics'
import { moveColumnKeyboardAction } from './keyboardActions'
import { reconcileColumnMoves } from './commitColumnMove'
import type { ColumnDraggingHooks } from './types'
import { columnDraggingLabels } from './labels'

export interface ColumnDraggingOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /**
   * A column was moved; a promise shows pending on the handle, a rejection returns the column
   * to its previous neighbors (ADR 0114).
   */
  onColumnDragEnd?: ColumnDraggingHooks['onColumnDragEnd']
  /**
   * Revert the move when the `onColumnDragEnd` promise rejects; `true` by default. `false` — the
   * client keeps the new order, a mismatch with the server is allowed (ADR 0114).
   */
  revertOnReject?: boolean
  /** The drag was cancelled: Escape, a drop outside, disallowed on the fly, the column went away (ADR 0040). */
  onColumnDragCancel?: ColumnDraggingHooks['onColumnDragCancel']
}

const columnDraggingEntry = definePlugin<ColumnDraggingOptions>()({
  id: 'columnDragging',
  labels: [columnDraggingLabels],
  actions: {
    drag: labels => columnDraggingLabels(labels).moveColumn,
    commitMove: labels => columnDraggingLabels(labels).moveColumn,
    dragCancel: labels => columnDraggingLabels(labels).actionDragCancel,
    drop: labels => columnDraggingLabels(labels).actionDrop,
    'columnDragging.move': labels => columnDraggingLabels(labels).moveColumn,
    handleMenu: labels => columnDraggingLabels(labels).actionHandleMenu,
  },
  features: { columnDraggingFeature, columnOrderingFeature },
  hooks: o => ({
    onColumnDragEnd: o.onColumnDragEnd,
    onColumnDragCancel: o.onColumnDragCancel,
  }),
  keyboardActions: [moveColumnKeyboardAction],
  diagnose: neverInert,
  reconcile: reconcileColumnMoves,
  slots: [
    {
      id: 'columnDraggingPlugin',
      slot: 'leftHeaderSlot',
      order: 0,
      component: ColumnDraggingComponent,
    },
  ],
  options: o => ({
    enableColumnDragging: o.enabled !== false,
    columnDragRevertOnReject: o.revertOnReject !== false,
  }),
})

export const columnDragging = withWrappers(columnDraggingEntry, {
  headBoundary: { id: 'columnDragging', component: HeadBoundary },
  headSeries: { id: 'columnDragging', component: HeadSeries },
  headCellDecorator: { id: 'columnDragging', component: SortableHeadCell },
})
