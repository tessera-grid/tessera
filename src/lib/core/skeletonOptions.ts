export interface SkeletonOptions {
  /**
   * number — фиксированное число колонок скелетонов;
   * auto — реальное число колонок, если доступно заранее.
   */
  columnsCount: number | 'auto'
  /**
   * number — фиксированное число строк скелетонов;
   * auto — реальное число данных, если доступно заранее.
   */
  rowsCount: number | 'auto'
  /**
   * grid — скелетоны соблюдают ширину реальной колонки (или max-ширину);
   * flex — скелетоны занимают всё доступное пространство.
   */
  layout: 'grid' | 'flex'
}

export const SKELETON_COLUMNS_COUNT = 8
export const SKELETON_ROWS_COUNT = 12

export const DEFAULT_SKELETON_OPTIONS: Required<SkeletonOptions> = {
  columnsCount: SKELETON_COLUMNS_COUNT,
  rowsCount: SKELETON_ROWS_COUNT,
  layout: 'flex',
}
