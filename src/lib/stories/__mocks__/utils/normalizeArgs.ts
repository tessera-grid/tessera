import { DEFAULT_SKELETON_OPTIONS } from '../../../../lib/core/skeletonOptions'

/** Размер из текстового контрола (ADR 0117, SN9): пусто — не задан, число — px. */
export const sizeArg = (
  value: number | string | undefined,
): number | string | undefined => {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text === '') return undefined
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : text
}

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

  return {
    ...args,
    skeletonOptions,
    height: sizeArg(args?.height),
    maxHeight: sizeArg(args?.maxHeight),
    containerHeight: sizeArg(args?.containerHeight),
  }
}
