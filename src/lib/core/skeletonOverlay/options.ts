import { SkeletonOptions } from './types'

export const SKELETON_COLUMNS_COUNT = 8
export const SKELETON_ROWS_COUNT = 12

export const DEFAULT_SKELETON_OPTIONS: Required<SkeletonOptions> = {
  columnsCount: SKELETON_COLUMNS_COUNT,
  rowsCount: SKELETON_ROWS_COUNT,
  layout: 'flex',
}
