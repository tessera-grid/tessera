import type { Active, Over, UniqueIdentifier } from '@dnd-kit/core'

import { hasExpandToggle } from '../../core/keyboardActions'
import type { Row } from '../../types'
import type { RowSortableData } from './types'

/**
 * Детей у строки: в серверной модели массива `subRows` нет — число сестёр первого ребёнка
 * (ADR 0159).
 */
const childCountOf = (row: Row<any, any>) => {
  if (row.subRows.length > 0) return row.subRows.length
  const source = (
    row.table as {
      getRowSource?: () => {
        indexOf: (id: string) => number
        treeAria?: (
          index: number,
        ) => { level: number; setSize: number } | undefined
      }
    }
  ).getRowSource?.()
  const index = source?.indexOf(row.id) ?? -1
  const child = index < 0 ? undefined : source?.treeAria?.(index + 1)
  return child?.level === row.depth + 2 ? child.setSize : 0
}

export const getMinDepth = (
  activeItem: Row<any, any>,
  targetItem: Row<any, any> | undefined,
  overId: UniqueIdentifier,
) => {
  if (!targetItem) return 0

  // Минимальная вложенность = 1, если роняем элемент на первое место раскрытой группы, и если это не единственный элемент в группе
  if ((targetItem.getIsExpanded?.() ?? false) && childCountOf(targetItem) > 1) {
    return targetItem.depth + 1
  }

  // Минимальная вложенность 0, если тащим элемент относящийся к любой группе, который изначально находится на последнем месте в группе
  if (activeItem.id === overId && activeItem.getIsLastSubRow()) {
    return targetItem.depth - 1
  }

  // Минимальная вложенность 0, если тащим элемент относящийся к любой группе, который перемещается на последнее место в группе
  if (activeItem.parentId && targetItem.getIsLastSubRow()) {
    return targetItem.depth - 1
  }

  // Минимальная вложенность 0, если тащим элемент изначально не относящийся ни к одной из групп, но который перемещается на последнее место в любой группе
  if (!activeItem.parentId && targetItem.getIsLastSubRow()) {
    return activeItem.depth
  }

  // Минимальная вложенность равняется изначальной вложенности целевого элемента
  return targetItem.depth
}

/**
 * Строка принимает детей переносом: группа, которую пользователь раскрывает сам, или уже
 * раскрытая. Свёрнутая группа дерева без переключателя — лист (ADR 0109, §5).
 */
export const canNestInto = (row: unknown, table: unknown) => {
  const r = row as {
    getCanExpand?: () => boolean
    getIsExpanded?: () => boolean
  }
  return (
    (r.getCanExpand?.() ?? false) &&
    ((r.getIsExpanded?.() ?? false) || hasExpandToggle(table))
  )
}

export const getMaxDepth = (
  targetItem: Row<any, any> | undefined,
  table: unknown,
) => {
  if (!targetItem) return 0

  // Минимальная вложенность + 1, если целевой элемент - это группа, либо минимальная вложенность равняется изначальной вложенности целевого элемента
  return canNestInto(targetItem, table)
    ? targetItem.depth + 1
    : targetItem.depth
}

export const getValidDepth = (
  currentDepth: number,
  minDepth: number,
  maxDepth: number,
) => {
  if (currentDepth >= maxDepth) {
    return maxDepth
  }

  if (currentDepth < minDepth) {
    return minDepth
  }

  return currentDepth
}

/**
 * Уровень слота (ADR 0137, §3): ближайший к `depth` допустимый уровень места
 * `minDepth…maxDepth`, при равенстве — меньший; `undefined` — допустимых уровней нет.
 */
export const getAllowedDepth = (
  depth: number,
  minDepth: number,
  maxDepth: number,
  allowed: (depth: number) => boolean,
) => {
  // `getValidDepth` при пределах наоборот отдаёт один из них — он тоже кандидат.
  const low = Math.min(minDepth, depth)
  const high = Math.max(maxDepth, depth)
  for (let distance = 0; distance <= high - low; distance++) {
    for (const candidate of [depth - distance, depth + distance]) {
      if (candidate >= low && candidate <= high && allowed(candidate)) {
        return candidate
      }
    }
  }
  return undefined
}

/**
 * @see BodyRow
 */
export const getDragSourceParams = (source: Active | Over) => {
  return source.data.current as RowSortableData
}

/**
 * @param offsetLeft Сумма пикселей, на которую смещается курсор влево/вправо
 * @param offsetLeftPx Фиксированное количество пикселей, которое визуально соответствует единице уровня вложенности
 * @example offsetLeftPx * 0 = 0 depth, offsetLeftPx * 1 = 1 depth, offsetLeftPx * 2 = 2 depth
 * @see getRowDraggableOffsetLeft
 */
export const getDepthFromOffsetLeft = (
  offsetLeft: number,
  offsetLeftPx: number,
) => {
  return Math.round(offsetLeft / offsetLeftPx)
}

/**
 * @param depth Уровень вложенности (пока что доступны только значения 0 и 1)
 * @param offsetLeftPx
 * @see getDepthFromOffsetLeft
 */
export const getOffsetLeftFromDepth = (depth: number, offsetLeftPx: number) => {
  return depth * offsetLeftPx
}

/**
 * Функция получения id родителя целевого элемента
 * В некоторых случаях это может быть id самого целевого элемента,
 * если это группа и уровень вложенности указывает на перемещение элемента в эту группу
 */
export const getTargetParentId = (
  targetItem: Row<any, any> | undefined,
  nextItem: Row<any, any> | undefined,
  currentDepth: number,
) => {
  if (currentDepth === 0 || !targetItem) {
    return undefined
  }

  if (currentDepth === targetItem.depth) {
    return targetItem.parentId
  }

  if (currentDepth < targetItem.depth) {
    return nextItem?.id ?? undefined
  }

  if (currentDepth > targetItem.depth) {
    return targetItem.id
  }

  return undefined
}

/**
 * Целевой индекс зависит от направления,
 * так как при движении вверх targetItem является элемент выше, а не тот, к которому применился transform
 */
export const getNewOriginalIndex = (
  overOriginalIndex: number,
  isDownMove: boolean,
) => (isDownMove ? overOriginalIndex : overOriginalIndex + 1)
