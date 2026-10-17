/**
 * Редьюсер dnd-событий перетаскивания столбцов. Активный id читается из
 * `table.atoms.columnDraggingActiveId`. Грид вызывает этот хелпер при wiring
 * DndContext.
 */
import { reportAction } from '../../core/debugActions'
import {
  holdSessionHooks,
  releaseSessionHooks,
  takeDragCancelReason,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import { applyNodeMove } from './moveColumn'
import {
  type NodeHeader,
  isMovableNode,
  siblingsOf,
} from '../../core/columnNodes'
import type { ColumnDraggingHooks, DragOverlayState } from './types'

// Табличный контракт, нужный редьюсеру (v9-методы + кастомные из columnDraggingFeature).
// Изменения стейта — через МЕТОДЫ таблицы (setColumnDraggingActiveId/setColumnOrder):
// v9 useTable возвращает фасад с сырыми options без фичевых on*Change-хендлеров.
// Активный id — `header.id` узла (у сегментов одной группы id колонки совпадает).
type DndTable = {
  setColumnDraggingActiveId: (value: DragOverlayState) => void
  atoms: { columnDraggingActiveId: { get: () => DragOverlayState } }
  getHooks: () => unknown
  getFlatHeaders: () => NodeHeader[]
}

export const getColumnDraggingEvents = (table: DndTable) => {
  const headerById = (id: unknown) =>
    table.getFlatHeaders().find(header => header.id === id)

  const reset = () => {
    document.body.style.cursor = 'default'
    table.setColumnDraggingActiveId(null)
    return releaseSessionHooks<Partial<ColumnDraggingHooks>>(
      table,
      'columnDragging',
    )
  }

  /** Сессия кончилась без перестановки (ADR 0040, §1). */
  const cancel = (reason: SessionCancelReason) => {
    const activeId = table.atoms.columnDraggingActiveId.get()
    const columnId = headerById(activeId)?.column.id ?? activeId
    reportAction(table, {
      plugin: 'columnDragging',
      action: 'dragCancel',
      detail: {
        columnId: columnId == null ? undefined : String(columnId),
        reason,
      },
      source: 'pointer',
      phase: 'end',
    })
    const { onColumnDragCancel } = reset()
    if (columnId !== null && columnId !== undefined) {
      onColumnDragCancel?.({ columnId: String(columnId), reason })
    }
  }

  /**
   * Переставить узел по броску; `false` — перестановки нет. Цель — сосед того же
   * родителя и зоны (столкновения считаются только с ними); бросок на неперемещаемого
   * соседа прижимает узел к краю перемещаемых.
   */
  const drop = (event: { over: { id: unknown } | null }): boolean => {
    const active = headerById(table.atoms.columnDraggingActiveId.get())
    const over = event.over ? headerById(event.over.id) : undefined
    if (!active || !over || active.id === over.id) {
      return false
    }
    const siblings = siblingsOf(table as never, active)
    const movable = siblings.filter(isMovableNode)
    if (!siblings.includes(over) || movable.length === 0) {
      return false
    }
    const position = (node: NodeHeader) => siblings.indexOf(node)
    const target = isMovableNode(over)
      ? over
      : position(over) < position(movable[0])
        ? movable[0]
        : movable[movable.length - 1]
    if (target.id === active.id) {
      return false
    }
    reportAction(table, {
      plugin: 'columnDragging',
      action: 'drop',
      detail: { columnId: active.column.id, targetId: target.column.id },
      source: 'pointer',
      phase: 'end',
    })
    applyNodeMove(table, active, target, position(target) > position(active))
    return true
  }

  return {
    onColumnDragStart: (event: { active: { id: DragOverlayState } }) => {
      document.body.style.cursor = 'grabbing'
      reportAction(table, {
        plugin: 'columnDragging',
        action: 'drag',
        detail: () => ({ columnId: headerById(event.active.id)?.column.id }),
        source: 'pointer',
        phase: 'start',
      })
      holdSessionHooks(table, 'columnDragging')
      table.setColumnDraggingActiveId(event.active.id)
    },
    // Отмена (Escape, запрет на лету, колонка ушла) — без перестановки.
    onColumnDragCancel: () => cancel(takeDragCancelReason()),
    // Бросок без перестановки (мимо, на то же место) — `cancel`.
    onColumnDragEnd: (event: { over: { id: unknown } | null }) => {
      if (drop(event)) {
        reset()
      } else {
        cancel('cancel')
      }
    },
  }
}
