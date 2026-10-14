import type { Row } from '../../types'
import { getNewOriginalIndex } from './draggingHelpers'

/** Параметры переноса строки, вычисленные в `onRowDragEnd`. */
export interface RowMove {
  activeParentId?: string
  overParentId?: string
  activeParentRow?: Row<any, any>
  activeOriginalIndex: number
  overOriginalIndex: number
  targetItem?: Row<any, any>
  isDownMove: boolean
  currentDepth: number
}

/**
 * Группа с копией `subRows` на месте исходной: перенос меняет копии, а не данные
 * приложения — обновитель чистый и выдерживает повторный вызов (StrictMode).
 */
const ownGroup = (newArray: any[], id: string | undefined) => {
  const index = newArray.findIndex(row => row.id === id)
  newArray[index] = {
    ...newArray[index],
    subRows: [...newArray[index].subRows],
  }
  return newArray[index]
}

/** Из root в root. */
const moveRootToRoot = (newArray: any[], move: RowMove) => {
  const { activeOriginalIndex, overOriginalIndex, targetItem } = move
  const activeItem = newArray[activeOriginalIndex]

  newArray.splice(activeOriginalIndex, 1)

  // targetItem отсутствует только при движении снизу вверх на самый первый индекс таблицы
  if (!targetItem) {
    newArray.splice(0, 0, activeItem)

    return newArray
  }

  // Если элемент перетаскивается не в группу, а на следующий индекс после неё,
  // берём индекс самой группы, а не последнего её элемента
  if (targetItem.getIsLastSubRow() && move.currentDepth === 0) {
    const nextIndexAfterExpandedGroup = getNewOriginalIndex(
      targetItem.getParentRow()!.index,
      move.isDownMove,
    )

    newArray.splice(nextIndexAfterExpandedGroup, 0, activeItem)

    return newArray
  }

  newArray.splice(
    getNewOriginalIndex(overOriginalIndex, move.isDownMove),
    0,
    activeItem,
  )

  return newArray
}

/** Из группы в группу (или в рамках одной группы). */
const moveGroupToGroup = (newArray: any[], move: RowMove) => {
  const { activeParentId, overParentId, activeOriginalIndex, targetItem } = move
  const activeParent = ownGroup(newArray, activeParentId)
  const activeItem = {
    ...activeParent.subRows[activeOriginalIndex],
    parentId: overParentId,
  }

  activeParent.subRows.splice(activeOriginalIndex, 1)

  // Новый индекс в целевой группе: в начало, если группа была свёрнута
  // (или подстрока перемещается под начало раскрытой группы), иначе под целевой.
  // Поправка на удалённую строку — только в своей группе: в чужой индексы не сдвинулись.
  const newIndexInGroup =
    targetItem?.id === overParentId
      ? 0
      : overParentId === activeParentId
        ? getNewOriginalIndex(move.overOriginalIndex, move.isDownMove)
        : move.overOriginalIndex + 1

  const overParent =
    overParentId === activeParentId
      ? activeParent
      : ownGroup(newArray, overParentId)
  overParent.subRows.splice(newIndexInGroup, 0, activeItem)

  return newArray
}

/** Из группы в root. */
const moveGroupToRoot = (
  newArray: any[],
  move: RowMove,
  activeParentRow: Row<any, any>,
) => {
  const { activeParentId, activeOriginalIndex, overOriginalIndex, targetItem } =
    move
  const activeParent = ownGroup(newArray, activeParentId)
  const activeItem = activeParent.subRows[activeOriginalIndex]

  activeParent.subRows.splice(activeOriginalIndex, 1)

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
  if (targetItem.getIsLastSubRow() && move.currentDepth === 0) {
    const nextIndexAfterExpandedGroup = targetItem.getParentRow()!.index + 1

    newArray.splice(nextIndexAfterExpandedGroup, 0, {
      ...activeItem,
      parentId: undefined,
    })

    return newArray
  }

  return newArray
}

/** Из root в группу. */
const moveRootToGroup = (newArray: any[], move: RowMove) => {
  const { overParentId, activeOriginalIndex, overOriginalIndex, targetItem } =
    move
  const activeItem = {
    ...newArray[activeOriginalIndex],
    parentId: overParentId,
  }

  newArray.splice(activeOriginalIndex, 1)

  // В начало, если группа была свёрнута, иначе под целевой индекс
  const newIndexInGroup =
    targetItem?.id === overParentId ? 0 : overOriginalIndex + 1

  ownGroup(newArray, overParentId).subRows.splice(
    newIndexInGroup,
    0,
    activeItem,
  )

  return newArray
}

/**
 * Новый порядок данных после переноса строки: root↔root, группа↔группа,
 * группа→root, root→группа. Подстроки переносятся в `subRows` исходных объектов.
 */
export const reorderRows = (prev: any[], move: RowMove): any[] => {
  const newArray = [...prev]
  const { activeParentId, overParentId, activeParentRow } = move

  if (!activeParentId && !overParentId) {
    return moveRootToRoot(newArray, move)
  }
  if (activeParentId && overParentId) {
    return moveGroupToGroup(newArray, move)
  }
  if (activeParentId && activeParentRow && !overParentId) {
    return moveGroupToRoot(newArray, move, activeParentRow)
  }
  if (!activeParentId && overParentId) {
    return moveRootToGroup(newArray, move)
  }

  return newArray
}
