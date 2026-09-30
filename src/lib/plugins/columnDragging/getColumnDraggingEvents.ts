/**
 * Редьюсер dnd-событий перетаскивания столбцов. Активный id читается из
 * `table.atoms.columnDraggingActiveId`. Грид вызывает этот хелпер при wiring
 * DndContext.
 */
import { arrayMove } from '@dnd-kit/sortable'

import {
  holdSessionHooks,
  releaseSessionHooks,
  takeDragCancelReason,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import { readPluginHooks } from '../../core/definePlugin'
import type { ColumnDraggingHooks, DragOverlayState } from './types'

// Табличный контракт, нужный редьюсеру (v9-методы + кастомные из columnDraggingFeature).
// Изменения стейта — через МЕТОДЫ таблицы (setColumnDraggingActiveId/setColumnOrder):
// v9 useTable возвращает фасад с сырыми options без фичевых on*Change-хендлеров.
type DndTable = {
  setColumnDraggingActiveId: (value: DragOverlayState) => void
  setColumnOrder: (updater: (prev: string[]) => string[]) => void
  atoms: { columnDraggingActiveId: { get: () => DragOverlayState } }
  getHooks: () => unknown
  getFlatHeaders: () => {
    id: string
    column: {
      id: string
      getIndex: () => number
      getDraggableIndex: () => number
      getCanDrag: () => boolean
      getIsPinned: () => false | 'start' | 'end'
    }
  }[]
  getVisibleLeafColumns: () => { id: string }[]
}

export const getColumnDraggingEvents = (table: DndTable) => {
  const { onColumnDragEnd } = readPluginHooks<ColumnDraggingHooks>(
    table,
    'columnDragging',
  )

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
    const columnId = table.atoms.columnDraggingActiveId.get()
    const { onColumnDragCancel } = reset()
    if (columnId !== null) {
      onColumnDragCancel?.({ columnId: String(columnId), reason })
    }
  }

  /** Переставить колонку по броску; `false` — перестановки нет. */
  const drop = (event: {
    over: { id: unknown; data: { current?: Record<string, unknown> } } | null
  }): boolean => {
    const { over } = event

    if (!over) {
      return false
    }

    const headers = table.getFlatHeaders()
    const columnDraggingActiveId = table.atoms.columnDraggingActiveId.get()

    const activeColumn = headers.find(
      header => header.column.id === columnDraggingActiveId,
    )?.column

    const activeOrderIndex = activeColumn?.getIndex()
    const activeDraggingIndex = activeColumn?.getDraggableIndex()

    const overOrderIndex = (over.data.current?.orderIndex as number) ?? null
    const overDraggingIndex =
      (over.data.current?.draggableIndex as number) ?? null
    const overIsDisabledSortable = !!over.data.current?.disabledSortable

    const firstDraggableNotPinnedColumn = headers.find(
      header =>
        header.column.getCanDrag() && header.column.getIsPinned() === false,
    )?.column
    const lastDraggableNotPinnedColumn = [...headers]
      .reverse()
      .find(
        header =>
          header.column.getCanDrag() && header.column.getIsPinned() === false,
      )?.column

    if (activeOrderIndex === undefined || activeDraggingIndex === undefined) {
      return false
    }
    if (overOrderIndex === null || overDraggingIndex === null) {
      return false
    }
    if (!firstDraggableNotPinnedColumn || !lastDraggableNotPinnedColumn) {
      return false
    }
    if (activeColumn?.id === over.id) {
      return false
    }

    let targetOrderIndex: number
    let hoverIndex: number

    if (!overIsDisabledSortable) {
      targetOrderIndex = overOrderIndex
      hoverIndex = overDraggingIndex
    } else {
      const dragIsOutOfRangeStart =
        overOrderIndex < firstDraggableNotPinnedColumn.getIndex()
      const edgeColumn = dragIsOutOfRangeStart
        ? firstDraggableNotPinnedColumn
        : lastDraggableNotPinnedColumn

      targetOrderIndex = edgeColumn.getIndex()
      hoverIndex = edgeColumn.getDraggableIndex()
    }

    // columnOrder по умолчанию пуст ([]) — визуальный порядок тогда задают сами
    // columnDef. Чтобы arrayMove не вернул [null], сидируем базу текущим порядком
    // видимых колонок, когда состояние ещё пустое.
    table.setColumnOrder(prev => {
      const base =
        prev.length > 0 ? prev : table.getVisibleLeafColumns().map(c => c.id)
      return arrayMove(base, activeOrderIndex, targetOrderIndex)
    })
    onColumnDragEnd?.({ dragIndex: activeDraggingIndex, hoverIndex })
    return true
  }

  return {
    onColumnDragStart: (event: { active: { id: DragOverlayState } }) => {
      document.body.style.cursor = 'grabbing'
      holdSessionHooks(table, 'columnDragging')
      table.setColumnDraggingActiveId(event.active.id)
    },
    // Отмена (Escape, запрет на лету, колонка ушла) — без перестановки.
    onColumnDragCancel: () => cancel(takeDragCancelReason()),
    // Бросок без перестановки (мимо, на то же место) — `cancel`.
    onColumnDragEnd: (event: {
      over: { id: unknown; data: { current?: Record<string, unknown> } } | null
    }) => {
      if (drop(event)) {
        reset()
      } else {
        cancel('cancel')
      }
    },
  }
}
