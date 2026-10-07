import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'

/**
 * Объектный аргумент Storybook с полем `number | string` после смены числа на строку и
 * перезагрузки истории приходит как NaN — возвращаем умолчание.
 */
export const normalizeArgs = (args: any) => {
  const skeletonOptions = args?.skeletonOptions

  if (skeletonOptions) {
    if (Number.isNaN(skeletonOptions.rowsCount)) {
      skeletonOptions.rowsCount = DEFAULT_SKELETON_OPTIONS.rowsCount
    }
    if (Number.isNaN(skeletonOptions.columnsCount)) {
      skeletonOptions.columnsCount = DEFAULT_SKELETON_OPTIONS.columnsCount
    }
  }

  return { ...args, skeletonOptions }
}
