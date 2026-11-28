/**
 * Запись плагина rowDragging на `definePlugin`. Кастомная фича
 * `rowDraggingFeature` (слайс состояния + row-метод getCanDrag) и сервисная
 * колонка-ручка. Обёртка тела, декораторы строки и незагруженной строки встраивают
 * dnd-kit в грид (ADR 0168, §2); dnd-редьюсер — getRowDraggingEvents.
 */
import { rowMover } from './historyMove'
import type { Updater } from '@tanstack/react-table'

import type { Row } from '../../types'
import { definePlugin } from '../../core/definePlugin'
import { withWrappers } from '../../core/pluginWrappers'
import { BodyBoundary } from './BodyBoundary'
import { DroppablePendingRow } from './DroppablePendingRow'
import { SortableRow } from './SortableRow'
import { COLUMN_DRAGGING_ID, getRowDraggingColumn } from './rowDraggingColumn'
import { moveRowKeyboardAction, nestRowKeyboardAction } from './keyboardActions'
import {
  rowDraggingFeature,
  rowDraggingInertReason,
} from './rowDraggingFeature'
import { reconcileRowMoves } from './reconcileRowMoves'
import type { RowDraggingHooks } from './types'
import { rowDraggingLabels } from './labels'
import { DEFAULT_ROW_DRAG_EXPAND_DELAY } from './getRowDraggingEvents'

export interface RowDraggingOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /** Whether a row can be dragged; any row by default. To disable the plugin — `enabled`. */
  canDragRow?: (row: Row<any, any>) => boolean
  /**
   * Pause over a collapsed group after which it expands, ms; 500 by default, `0` — never expand
   * (ADR 0109).
   */
  expandDelay?: number
  /**
   * A row was moved: its place after the move; a promise shows pending on the handle. In a lazy
   * tree a move isn't allowed without it (ADR 0112).
   */
  onRowDragEnd?: RowDraggingHooks['onRowDragEnd']
  /**
   * Revert the move when the `onRowDragEnd` promise rejects; `true` by default. `false` — the
   * client keeps the new order, a mismatch with the server is allowed (ADR 0114).
   */
  revertOnReject?: boolean
  /** The drag was cancelled: Escape, a drop outside, disallowed on the fly, the row went away (ADR 0040). */
  onRowDragCancel?: RowDraggingHooks['onRowDragCancel']
  /**
   * The new data order after the move — as a function of the previous one (ADR 0120, §4): the
   * application applies it to its `data`.
   */
  onRowOrderChange?: (updater: Updater<any[]>) => void
}

const rowDraggingEntry = definePlugin<RowDraggingOptions>()({
  id: 'rowDragging',
  labels: [rowDraggingLabels],
  actions: {
    drag: labels => rowDraggingLabels(labels).moveRow,
    commitMove: labels => rowDraggingLabels(labels).moveRow,
    dragCancel: labels => rowDraggingLabels(labels).actionDragCancel,
    dragOver: labels => rowDraggingLabels(labels).actionDragOver,
    drop: labels => rowDraggingLabels(labels).actionDrop,
    expandOnHover: labels => rowDraggingLabels(labels).actionExpandOnHover,
    awaitBranch: labels => rowDraggingLabels(labels).actionAwaitBranch,
    'rowDragging.move': labels => rowDraggingLabels(labels).moveRow,
    'rowDragging.nest': labels => rowDraggingLabels(labels).actionNest,
    handleMenu: labels => rowDraggingLabels(labels).actionHandleMenu,
  },
  // Предикат влияет на отрисовку ячеек: новая ссылка — перерисовка (ADR 0039).
  refreshOn: ['canDragRow'],
  features: { rowDraggingFeature },
  hooks: o => ({
    onRowDragEnd: o.onRowDragEnd,
    onRowDragCancel: o.onRowDragCancel,
  }),
  keyboardActions: [moveRowKeyboardAction, nestRowKeyboardAction],
  diagnose: rowDraggingInertReason,
  reconcile: reconcileRowMoves,
  column: {
    id: COLUMN_DRAGGING_ID,
    make: getRowDraggingColumn,
    side: 'leading',
    order: 0,
    pin: { side: 'start', when: 'with-user' },
    label: labels => rowDraggingLabels(labels).reorderColumn,
  },
  options: o => ({
    enableRowDragging: o.enabled === false ? false : (o.canDragRow ?? true),
    rowDragExpandDelay: o.expandDelay ?? DEFAULT_ROW_DRAG_EXPAND_DELAY,
    rowDragRevertOnReject: o.revertOnReject !== false,
    rowDragReportsMoves: !!o.onRowDragEnd,
    onRowOrderChange: o.onRowOrderChange,
    ...(o.enabled === false ? {} : { rowMover }),
  }),
})

export const rowDragging = withWrappers(rowDraggingEntry, {
  bodyBoundary: { id: 'rowDragging', component: BodyBoundary },
  rowDecorator: { id: 'rowDragging', component: SortableRow },
  pendingRowDecorator: { id: 'rowDragging', component: DroppablePendingRow },
})
