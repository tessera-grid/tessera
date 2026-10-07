import type {
  DragAbortEvent,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'

import type { Row, Table } from '../../types'
import {
  holdSessionHooks,
  releaseSessionHooks,
  takeDragCancelReason,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import {
  getDepthFromOffsetLeft,
  getDragSourceParams,
  getMaxDepth,
  getMinDepth,
  getOffsetLeftFromDepth,
  getTargetParentId,
  getValidDepth,
} from './draggingHelpers'
import { getRowDraggableOffsetLeft } from './getRowDraggableOffsetLeft'
import { reorderRows } from './reorderRows'
import type {
  RowDraggingHooks,
  RowDragOverlayState,
  RowSortableData,
} from './types'

/**
 * Редьюсер DnD-событий тела: переупорядочивание строк c поддержкой вложенности
 * (root↔группа, группа↔группа), временного сворачивания перетаскиваемой группы и
 * ограничения глубины. Читает снимок overlay-состояния из атома `rowDragging` и
 * пишет через опции rowDragging/rowExpanding.
 */
export const getRowDraggingEvents = (
  table: Table<any, any>,
): {
  onRowDragStart?: (event: DragStartEvent) => void
  onRowDragMove?: (event: DragMoveEvent) => void
  onRowDragEnd?: (event: DragEndEvent) => void
  onRowDragCancel?: (event: DragCancelEvent) => void
  onRowDragAbort?: (event: DragAbortEvent) => void
} => {
  const rowModel = table.getRowModel()
  const rows = rowModel?.rows

  const rowDraggingState = (
    table as unknown as {
      atoms: { rowDragging: { get: () => RowDragOverlayState } }
    }
  ).atoms.rowDragging.get()

  // v9 useTable возвращает фасад с сырыми options (без фичевых defaults), поэтому
  // overlay-состояние меняем методом table.setRowDragging (бьёт по внутреннему
  // updater), а не через table.options.onRowDraggingChange. onRowOrderChange/
  // onExpandedChange передаёт потребитель — они на возвращаемых options есть.
  const onRowDraggingChange = (
    table as unknown as {
      setRowDragging: (
        updater: (prev: RowDragOverlayState) => RowDragOverlayState,
      ) => void
    }
  ).setRowDragging
  const { onRowOrderChange, onExpandedChange } = table.options as unknown as {
    onRowOrderChange?: (updater: (prev: any[]) => any[]) => void
    onExpandedChange?: (
      updater: true | Record<string, boolean> | ((prev: any) => any),
    ) => void
  }

  /** Свернуть/развернуть группу до и после перетаскивания. */
  const expandGroup = (groupId: UniqueIdentifier, expanded: boolean) => {
    onExpandedChange?.((prev: any) =>
      prev === true
        ? { [groupId]: expanded }
        : {
            ...prev,
            [groupId]: expanded,
          },
    )
  }

  /** Непустая перетаскиваемая группа временно сворачивается. */
  const collapseDraggableGroup = (row: Row<any, any>) => {
    if (row.subRows.length > 0) {
      expandGroup(row.id, false)
    }
  }

  /** Развернуть группу после перетаскивания, если до него она была развёрнута. */
  const expandDraggableGroupAgain = (row: Row<any, any>) => {
    if (row.subRows.length > 0 && rowDraggingState.isExpanded) {
      expandGroup(row.id, true)
    }
  }

  /**
   * Целевой элемент при движении вверх/вниз. Он не всегда равен элементу под
   * курсором — выбираем его исходя из направления движения.
   */
  const getTargetItems = (
    activeVirtualIndex: number,
    overVirtualIndex: number,
  ) => {
    const isDownMove = activeVirtualIndex < overVirtualIndex

    const overItem = rows[overVirtualIndex]
    const prevItem = rows[overVirtualIndex - 1]
    const nextItem = rows[overVirtualIndex + 1]
    const targetItem = (isDownMove ? overItem : prevItem) as
      Row<any, any> | undefined

    return { targetItem, prevItem, nextItem, isDownMove }
  }

  const resetDragState = () => {
    document.body.style.cursor = 'default'
    onRowDraggingChange?.(() => ({
      activeId: null,
      offsetLeft: 0,
      isExpanded: false,
      acceptable: true,
    }))
  }

  /** Сессия кончилась без перестановки (ADR 0040, §1). */
  const cancel = (rowId: UniqueIdentifier, reason: SessionCancelReason) => {
    resetDragState()
    releaseSessionHooks<Partial<RowDraggingHooks>>(
      table as never,
      'rowDragging',
    ).onRowDragCancel?.({ rowId: String(rowId), reason })
  }

  // Шаг уровня читается из темы на старте перетаскивания, а не в рендере (RE64):
  // обработчики, пересозданные посреди перетаскивания, читают его при первом событии.
  let levelStep: number | undefined
  const getLevelStep = () =>
    (levelStep ??= getRowDraggableOffsetLeft({ table }))

  return {
    onRowDragStart: ({ active }) => {
      const { row } = active.data.current as RowSortableData
      levelStep = getRowDraggableOffsetLeft({ table })

      document.body.style.cursor = 'grabbing'
      holdSessionHooks(table as never, 'rowDragging')
      onRowDraggingChange(prev => ({
        ...prev,
        activeId: active.id,
        // Начальная позиция индикатора вложенности
        offsetLeft: row.getIsLastSubRow()
          ? 0
          : getOffsetLeftFromDepth(row.depth, getLevelStep()),
        // Запомнить, была ли открыта группа до перетаскивания, чтобы свернуть её на
        // время и после открыть вновь (rowExpanding может отсутствовать → false).
        isExpanded: row.getIsExpanded?.() ?? false,
        // Возможность переместить строку на данную вложенность (зависит от
        // ограничения по глубине вложенности)
        acceptable: true,
      }))

      collapseDraggableGroup(row)
    },
    onRowDragMove: ({ active, over, delta }) => {
      if (!over) {
        return
      }

      const { virtualIndex: activeVirtualIndex, row: activeRow } =
        getDragSourceParams(active)
      const { virtualIndex: overVirtualIndex } = getDragSourceParams(over)

      const { targetItem } = getTargetItems(
        activeVirtualIndex,
        overVirtualIndex,
      )

      const currentDepth = getDepthFromOffsetLeft(delta.x, getLevelStep())

      const minDepth = getMinDepth(activeRow, targetItem, over.id)
      const maxDepth = getMaxDepth(targetItem)
      const validDepth = getValidDepth(currentDepth, minDepth, maxDepth)

      onRowDraggingChange?.(prev => ({
        ...prev,
        offsetLeft: getOffsetLeftFromDepth(validDepth, getLevelStep()),
        // Вложенность больше 1 сейчас не поддерживается.
        acceptable:
          (activeRow.getCanExpand?.() ?? false) ? validDepth === 0 : true,
      }))
    },
    onRowDragEnd: ({ active, over }) => {
      const {
        virtualIndex: activeVirtualIndex,
        row: activeRow,
        parentRow: activeParentRow,
      } = getDragSourceParams(active)

      const activeIsGroup = activeRow.subRows.length > 0

      // Бросок без перестановки (мимо, на то же место, недопустимо) — `cancel`.
      if (!over || !rowDraggingState.acceptable) {
        expandDraggableGroupAgain(activeRow)

        return cancel(active.id, 'cancel')
      }

      const { virtualIndex: overVirtualIndex } = getDragSourceParams(over)

      const { targetItem, nextItem, isDownMove } = getTargetItems(
        activeVirtualIndex,
        overVirtualIndex,
      )

      const currentDepth = getDepthFromOffsetLeft(
        rowDraggingState.offsetLeft,
        getLevelStep(),
      )

      // Если id или вложенность не поменялась, элемент остаётся на месте
      if (active.id === over?.id && activeRow.depth === currentDepth) {
        expandDraggableGroupAgain(activeRow)

        return cancel(active.id, 'cancel')
      }

      const activeParentId = activeRow.parentId
      const overParentId = getTargetParentId(targetItem, nextItem, currentDepth)

      const activeOriginalIndex = activeRow.index
      const overOriginalIndex = targetItem?.index || 0

      // Группа не может быть помещена в другую группу
      if (activeIsGroup && !!overParentId) {
        expandDraggableGroupAgain(activeRow)

        return cancel(active.id, 'cancel')
      }

      onRowOrderChange?.(prev =>
        reorderRows(prev, {
          activeParentId,
          overParentId,
          activeParentRow,
          activeOriginalIndex,
          overOriginalIndex,
          targetItem,
          isDownMove,
          currentDepth,
        }),
      )

      expandDraggableGroupAgain(activeRow)
      releaseSessionHooks<Partial<RowDraggingHooks>>(
        table as never,
        'rowDragging',
      ).onRowDragEnd?.({
        rowId: String(active.id),
        dragIndex: activeVirtualIndex,
        hoverIndex: overVirtualIndex,
      })

      return resetDragState()
    },
    // Отмена (Escape, запрет на лету, строка ушла).
    onRowDragCancel: ({ active }) => {
      const { row: activeRow } = getDragSourceParams(active)

      expandDraggableGroupAgain(activeRow)

      return cancel(active.id, takeDragCancelReason())
    },
    onRowDragAbort: resetDragState,
  }
}
