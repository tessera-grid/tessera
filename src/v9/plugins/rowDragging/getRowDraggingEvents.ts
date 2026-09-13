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
  getDepthFromOffsetLeft,
  getDragSourceParams,
  getMaxDepth,
  getMinDepth,
  getNewOriginalIndex,
  getOffsetLeftFromDepth,
  getTargetParentId,
  getValidDepth,
} from './draggingHelpers'
import { getRowDraggableOffsetLeft } from './getRowDraggableOffsetLeft'
import type { RowDragOverlayState, RowSortableData } from './types'

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

  const { onRowDraggingChange, onRowOrderChange, onExpandedChange } =
    table.options as unknown as {
      onRowDraggingChange: (
        updater: (prev: RowDragOverlayState) => RowDragOverlayState,
      ) => void
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
      | Row<any, any>
      | undefined

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

  const constOffsetLeft = getRowDraggableOffsetLeft({ table })

  return {
    onRowDragStart: ({ active }) => {
      const { row } = active.data.current as RowSortableData

      document.body.style.cursor = 'grabbing'
      onRowDraggingChange(prev => ({
        ...prev,
        activeId: active.id,
        // Начальная позиция индикатора вложенности
        offsetLeft: row.getIsLastSubRow()
          ? 0
          : getOffsetLeftFromDepth(row.depth, constOffsetLeft),
        // Запомнить, была ли открыта группа до перетаскивания, чтобы свернуть её на
        // время и после открыть вновь
        isExpanded: row.getIsExpanded(),
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

      const currentDepth = getDepthFromOffsetLeft(delta.x, constOffsetLeft)

      const minDepth = getMinDepth(activeRow, targetItem, over.id)
      const maxDepth = getMaxDepth(targetItem)
      const validDepth = getValidDepth(currentDepth, minDepth, maxDepth)

      onRowDraggingChange?.(prev => ({
        ...prev,
        offsetLeft: getOffsetLeftFromDepth(validDepth, constOffsetLeft),
        // Вложенность больше 1 сейчас не поддерживается.
        acceptable: activeRow.getCanExpand() ? validDepth === 0 : true,
      }))
    },
    onRowDragEnd: ({ active, over }) => {
      const {
        virtualIndex: activeVirtualIndex,
        row: activeRow,
        parentRow: activeParentRow,
      } = getDragSourceParams(active)

      const activeIsGroup = activeRow.subRows.length > 0

      if (!over || !rowDraggingState.acceptable) {
        expandDraggableGroupAgain(activeRow)

        return resetDragState()
      }

      const { virtualIndex: overVirtualIndex } = getDragSourceParams(over)

      const { targetItem, nextItem, isDownMove } = getTargetItems(
        activeVirtualIndex,
        overVirtualIndex,
      )

      const currentDepth = getDepthFromOffsetLeft(
        rowDraggingState.offsetLeft,
        constOffsetLeft,
      )

      // Если id или вложенность не поменялась, элемент остаётся на месте
      if (active.id === over?.id && activeRow.depth === currentDepth) {
        expandDraggableGroupAgain(activeRow)

        return resetDragState()
      }

      const activeParentId = activeRow.parentId
      const overParentId = getTargetParentId(targetItem, nextItem, currentDepth)

      const activeOriginalIndex = activeRow.index
      const overOriginalIndex = targetItem?.index || 0

      // Группа не может быть помещена в другую группу
      if (activeIsGroup && !!overParentId) {
        expandDraggableGroupAgain(activeRow)

        return resetDragState()
      }

      onRowOrderChange?.((prev: any[]) => {
        const newArray = [...prev]

        // Из root в root
        if (!activeParentId && !overParentId) {
          const activeItem = newArray[activeOriginalIndex]

          newArray.splice(activeOriginalIndex, 1)

          // targetItem отсутствует только при движении снизу вверх на самый первый индекс таблицы
          if (!targetItem) {
            newArray.splice(0, 0, activeItem)

            return newArray
          }

          // Если элемент перетаскивается не в группу, а на следующий индекс после неё,
          // берём индекс самой группы, а не последнего её элемента
          if (targetItem.getIsLastSubRow() && currentDepth === 0) {
            const nextIndexAfterExpandedGroup = getNewOriginalIndex(
              targetItem.getParentRow()!.index,
              isDownMove,
            )

            newArray.splice(nextIndexAfterExpandedGroup, 0, activeItem)

            return newArray
          }

          newArray.splice(
            getNewOriginalIndex(overOriginalIndex, isDownMove),
            0,
            activeItem,
          )

          return newArray
        }

        // Из группы в группу (или в рамках одной группы)
        if (activeParentId && overParentId) {
          const activeParentIndex = newArray.findIndex(
            row => row.id === activeParentId,
          )

          const activeItem =
            newArray[activeParentIndex].subRows[activeOriginalIndex]

          newArray[activeParentIndex].subRows.splice(activeOriginalIndex, 1)

          // Новый индекс в целевой группе: в начало, если группа была свёрнута
          // (или подстрока перемещается под начало раскрытой группы), иначе целевой
          const newIndexInGroup =
            targetItem?.id === overParentId
              ? 0
              : getNewOriginalIndex(overOriginalIndex, isDownMove)

          activeItem.parentId = overParentId

          // Индекс целевой группы ищем непосредственно перед вставкой (выше много splice)
          const overParentIndex = newArray.findIndex(
            row => row.id === overParentId,
          )

          newArray[overParentIndex].subRows.splice(
            newIndexInGroup,
            0,
            activeItem,
          )

          return newArray
        }

        // Из группы в root
        if (activeParentId && activeParentRow && !overParentId) {
          const activeParentIndex = newArray.findIndex(
            row => row.id === activeParentId,
          )

          const activeItem =
            newArray[activeParentIndex].subRows[activeOriginalIndex]

          newArray[activeParentIndex].subRows.splice(activeOriginalIndex, 1)

          // targetItem отсутствует только при движении снизу вверх на первый индекс таблицы
          if (!targetItem) {
            newArray.splice(0, 0, {
              ...activeItem,
              parentId: undefined,
            })

            return newArray
          }

          if (!targetItem.parentId) {
            newArray.splice(overOriginalIndex + 1, 0, {
              ...activeItem,
              parentId: undefined,
            })

            return newArray
          }

          // Переместить на индекс ниже группы, из которой элемент удалён, если он
          // должен располагаться сразу после её последней подстроки
          if (targetItem.parentId === activeParentId) {
            newArray.splice(activeParentRow.index + 1, 0, {
              ...activeItem,
              parentId: undefined,
            })

            return newArray
          }

          // Не в группу, а на следующий индекс после неё — индекс самой группы
          if (targetItem.getIsLastSubRow() && currentDepth === 0) {
            const nextIndexAfterExpandedGroup =
              targetItem.getParentRow()!.index + 1

            newArray.splice(nextIndexAfterExpandedGroup, 0, activeItem)

            return newArray
          }

          return newArray
        }

        // Из root в группу
        if (!activeParentId && overParentId) {
          const activeItem = newArray[activeOriginalIndex]

          newArray.splice(activeOriginalIndex, 1)

          // В начало, если группа была свёрнута, иначе под целевой индекс
          const newIndexInGroup =
            targetItem?.id === overParentId ? 0 : overOriginalIndex + 1

          activeItem.parentId = overParentId

          const overParentIndex = newArray.findIndex(
            row => row.id === overParentId,
          )

          newArray[overParentIndex].subRows.splice(
            newIndexInGroup,
            0,
            activeItem,
          )

          return newArray
        }

        return newArray
      })

      expandDraggableGroupAgain(activeRow)

      return resetDragState()
    },
    onRowDragCancel: ({ active }) => {
      const { row: activeRow } = getDragSourceParams(active)

      expandDraggableGroupAgain(activeRow)

      return resetDragState()
    },
    onRowDragAbort: resetDragState,
  }
}
