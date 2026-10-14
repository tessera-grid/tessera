/** Типы плагина columnDragging. */
import type { UniqueIdentifier } from '@dnd-kit/core'

import type { SessionCancelReason } from '../../core/cancelInteraction'

export type DragOverlayState = UniqueIdentifier | null

export interface ColumnDraggingState {
  columnDraggingActiveId: DragOverlayState
}

export interface ColumnDraggingHooks {
  /**
   * Колонка перенесена; промис — ожидание на ручке, отказ возвращает колонку к прежним
   * соседям (ADR 0114).
   */
  onColumnDragEnd: (props: {
    /** Индекс среди перетаскиваемых листьев; у группы — её первого листа. */
    dragIndex: number
    hoverIndex: number
    /** Перенесённый узел — лист или группа (ADR 0052). */
    columnId: string
    /** Новый порядок листьев. */
    columnOrder: string[]
  }) => void | PromiseLike<unknown>
  /** Перетаскивание завершилось без перестановки (ADR 0040, §1). */
  onColumnDragCancel?: (end: {
    columnId: string
    reason: SessionCancelReason
  }) => void
}
