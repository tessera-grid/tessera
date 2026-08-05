import {
  DragAbortEvent,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { Row, Table } from '@tanstack/react-table'

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
import { RowSortableData } from './types'

/**
 * // TODO: запишите себе плиз все кейсы и удалите этот комент
 *
 * Возможные кейсы:
 *
 * root -> root
 *
 * - строка -> нулевой индекс таблицы (движение вверх)
 * - строка -> строка (движение вниз)
 * - строка -> строка (движение вверх)
 * - строка -> следующий индекс после свернутой группы (движение вниз)
 * - строка -> следующий индекс после свернутой группы (движение вверх)
 * - строка -> следующий индекс после развернутой группы (движение вниз)
 * - строка -> следующий индекс после развернутой группы (движение вверх)
 *
 * root -> группа
 *
 * - строка -> внутрь свернутой группы (движение вниз)
 * - строка -> внутрь свернутой группы (движение вверх)
 * - строка -> нулевой индекс развернутой группы (движение вниз)
 * - строка -> нулевой индекс развернутой группы (движение вверх)
 * - строка -> средний индекс развернутой группы (движение вниз)
 * - строка -> средний индекс развернутой группы (движение вверх)
 * - строка -> последний индекс развернутой группы (движение вниз)
 * - строка -> последний индекс развернутой группы (движение вверх)
 *
 * группа -> группа (в рамках одной группы)
 *
 * - строка -> строка (движение вниз)
 * - строка -> строка (движение вверх)
 * - строка -> нулевой индекс группы (движение вверх)
 * - строка -> последний индекс группы (движение вниз)
 *
 * группа -> группа (в рамках двух разных групп)
 *
 * - строка -> внутрь свернутой группы (движение вниз)
 * - строка -> внутрь свернутой группы (движение вверх)
 * - строка -> строка (движение вниз)
 * - строка -> строка (движение вверх)
 * - строка -> нулевой индекс развернутой группы (движение вниз)
 * - строка -> нулевой индекс развернутой группы (движение вверх)
 * - строка -> средний индекс развернутой группы (движение вниз)
 * - строка -> средний индекс развернутой группы (движение вверх)
 * - строка -> последний индекс развернутой группы (движение вниз)
 * - строка -> последний индекс развернутой группы (движение вверх)
 *
 * группа -> root
 *
 * - строка -> нулевой индекс таблицы (движение вверх)
 * - строка -> строка (движение вниз)
 * - строка -> строка (движение вверх)
 * - строка -> последний индекс этой же развернутой группы (движение вниз)
 * - строка -> следующий индекс после свернутой группы (движение вниз)
 * - строка -> следующий индекс после свернутой группы (движение вверх)
 * - строка -> следующий индекс после развернутой группы (движение вниз)
 * - строка -> следующий индекс после развернутой группы (движение вверх)
 *
 * Запрещенные кейсы:
 *
 * группа -> группа
 *
 * - любая группа -> любая группа
 * - любая группа -> любая подстрока
 */
export const getRowDraggingEvents = (
  table: Table<any>,
): {
  onRowDragStart?: (event: DragStartEvent) => void
  onRowDragMove?: (event: DragMoveEvent) => void
  onRowDragEnd?: (event: DragEndEvent) => void
  onRowDragCancel?: (event: DragCancelEvent) => void
  onRowDragAbort?: (event: DragAbortEvent) => void
} => {
  const rowModel = table.getRowModel()
  const rows = rowModel?.rows

  const { rowDragging: rowDraggingState } = table.getState()
  const { onRowDraggingChange, onRowOrderChange, onExpandedChange } =
    table.options

  /**
   * Функция сворачивания/разворачивания группы до и после перетаскивания
   */
  const expandGroup = (groupId: UniqueIdentifier, expanded: boolean) => {
    onExpandedChange?.(prev =>
      prev === true
        ? { [groupId]: expanded }
        : {
            ...prev,
            [groupId]: expanded,
          },
    )
  }

  /**
   * Если перетаскивается группа и она не пуста, то она должна быть временно свернута
   */
  const collapseDraggableGroup = (row: Row<any>) => {
    if (row.subRows.length > 0) {
      expandGroup(row.id, false)
    }
  }

  /**
   * Развернуть группу после перетаскивания, если до перетаскивания она была развернута
   * Иначе этого делать не нужно
   */
  const expandDraggableGroupAgain = (row: Row<any>) => {
    if (row.subRows.length > 0 && rowDraggingState.isExpanded) {
      expandGroup(row.id, true)
    }
  }

  /**
   * Функция получения целевого элемента при движении вверх/вниз
   * Целевой элемент не всегда равен элементу, на который мы наводимся при сортировке
   * Поэтому получаем его исходя из направления движения
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
      Row<any> | undefined

    return { targetItem, prevItem, nextItem, isDownMove }
  }

  const resetDragState = () => {
    document.body.style.cursor = 'default'
    onRowDraggingChange?.({
      activeId: null,
      offsetLeft: 0,
      isExpanded: false,
      acceptable: true,
    })
  }

  const constOffsetLeft = getRowDraggableOffsetLeft({ table })

  return {
    onRowDragStart: ({ active }) => {
      const { row } = active.data.current as RowSortableData

      document.body.style.cursor = 'grabbing'
      table.options.onRowDraggingChange(prev => ({
        ...prev,
        activeId: active.id,
        // Начальная позиция индикатора вложенности
        offsetLeft: row.getIsLastSubRow()
          ? 0
          : getOffsetLeftFromDepth(row.depth, constOffsetLeft),
        // Запомнить, была ли открыта группа до ее перетаскивания, чтобы свернуть ее на время перетаскивания и после открыть ее вновь
        isExpanded: row.getIsExpanded(),
        // Признак определения возможности переместить строку на данную вложенность (зависит от ограничения по глубине вложенности)
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
        // TODO: в данный момент dnd на вложенность больше чем 1 не поддерживается!
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

      // Если id или вложенность не поменялась, то элемент должен остаться на своем месте
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

      onRowOrderChange?.(prev => {
        const newArray = [...prev]

        // Из root в root
        if (!activeParentId && !overParentId) {
          const activeItem = newArray[activeOriginalIndex]

          newArray.splice(activeOriginalIndex, 1)

          // targetItem может отсутствовать только тогда, когда перетаскивание происходит снизу вверх и на самый первый индекс таблицы
          if (!targetItem) {
            newArray.splice(0, 0, activeItem)

            return newArray
          }

          // Если элемент перетаскивается не в группу, а на следующий индекс после нее,
          // то берем индекс не последнего элемента этой группы, а индекс самой группы
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
          // Найти индекс группы перетаскиваемого элемента в root
          const activeParentIndex = newArray.findIndex(
            row => row.id === activeParentId,
          )

          // Найти перетаскиваемый элемент в группе по его оригинальному индексу
          const activeItem =
            newArray[activeParentIndex].subRows[activeOriginalIndex]

          // Удалить его из группы
          newArray[activeParentIndex].subRows.splice(activeOriginalIndex, 1)

          // Рассчитать для него новый индекс в другой группе
          // переместить его в начало списка подстрок, если группа была свернута
          // (или если подстрока перемещается под начало раскрытой группы),
          // иначе же присвоить целевой индекс
          const newIndexInGroup =
            targetItem?.id === overParentId
              ? 0
              : getNewOriginalIndex(overOriginalIndex, isDownMove)

          // Присвоить перетаскиваемому элементу id нового родителя
          activeItem.parentId = overParentId

          // Найти индекс целевой группы в root
          // Важно находить индекс целевой группы непосредственно перед использованием, так как выше происходит много операций splice
          const overParentIndex = newArray.findIndex(
            row => row.id === overParentId,
          )

          // Вставить перетаскиваемый элемент в новую группу по рассчитанному индексу
          newArray[overParentIndex].subRows.splice(
            newIndexInGroup,
            0,
            activeItem,
          )

          return newArray
        }

        // Из группы в root
        if (activeParentId && activeParentRow && !overParentId) {
          // Найти индекс группы перетаскиваемого элемента в root
          const activeParentIndex = newArray.findIndex(
            row => row.id === activeParentId,
          )

          // Найти перетаскиваемый элемент в группе по его оригинальному индексу
          const activeItem =
            newArray[activeParentIndex].subRows[activeOriginalIndex]

          // Удалить его из группы
          newArray[activeParentIndex].subRows.splice(activeOriginalIndex, 1)

          // targetItem может отсутствовать только тогда, когда перетаскивание происходит снизу вверх и на самый первый индекс таблицы
          if (!targetItem) {
            newArray.splice(0, 0, {
              ...activeItem,
              parentId: undefined,
            })

            return newArray
          }

          // Переместить элемент под целевым индексом (где отображается индикатор)
          // TODO: я не успел разобраться почему в случае root -> root +1 делается по условию, а здесь всегда
          if (!targetItem.parentId) {
            newArray.splice(overOriginalIndex + 1, 0, {
              ...activeItem,
              parentId: undefined,
            })

            return newArray
          }

          // Переместить элемент на индекс ниже его группы, из которой он был удален,
          // если элемент должен располагаться сразу после последней подстроки этой группы
          if (targetItem.parentId === activeParentId) {
            newArray.splice(activeParentRow.index + 1, 0, {
              ...activeItem,
              parentId: undefined,
            })

            return newArray
          }

          // Если элемент перетаскивается не в группу, а на следующий индекс после нее,
          // то берем индекс не последнего элемента этой группы, а индекс самой группы
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
          // Найти перетаскиваемый элемент по его оригинальному индексу
          const activeItem = newArray[activeOriginalIndex]

          // Удалить перетаскиваемый элемент по его оригинальному индексу
          newArray.splice(activeOriginalIndex, 1)

          // Рассчитать для него новый индекс в другой группе
          // переместить его в начало списка подстрок, если группа была свернута,
          // либо переместить элемент под целевым индексом (где отображается индикатор)
          // TODO: я не успел разобраться почему в случае root -> root +1 делается по условию, а здесь всегда
          const newIndexInGroup =
            targetItem?.id === overParentId ? 0 : overOriginalIndex + 1

          // Присвоить перетаскиваемому элементу id нового родителя
          activeItem.parentId = overParentId

          // Найти индекс целевой группы в root
          // Важно находить индекс целевой группы непосредственно перед использованием, так как выше происходит много операций splice
          const overParentIndex = newArray.findIndex(
            row => row.id === overParentId,
          )

          // Вставить перетаскиваемый элемент в новую группу по рассчитанному индексу
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
