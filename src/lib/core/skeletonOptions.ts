export interface SkeletonOptions {
  /**
   * Строк скелета: число — ровно столько; `'auto'` — сколько помещается по высоте
   * (с пагинацией — не больше размера страницы).
   */
  rowsCount?: number | 'auto'
  /** Колонок скелета, когда своих колонок у грида нет (`columns: []`). */
  columnsCount?: number
}

export const SKELETON_COLUMNS_COUNT = 8
/** Строк, если высоту области посчитать нельзя (она растёт по содержимому). */
export const SKELETON_ROWS_COUNT = 12

export const DEFAULT_SKELETON_OPTIONS: Required<SkeletonOptions> = {
  rowsCount: 'auto',
  columnsCount: SKELETON_COLUMNS_COUNT,
}

export const resolveSkeletonOptions = (
  options: SkeletonOptions | undefined,
): Required<SkeletonOptions> => ({
  rowsCount: options?.rowsCount ?? DEFAULT_SKELETON_OPTIONS.rowsCount,
  columnsCount: options?.columnsCount ?? DEFAULT_SKELETON_OPTIONS.columnsCount,
})

export interface SkeletonRowCountParams {
  rowsCount: number | 'auto'
  /** Высота тела, доступная строкам (без шапки и футера), px. */
  bodyHeight: number
  rowHeight: number
  /** Размер страницы, если подключена пагинация. */
  pageSize?: number
}

/** Число строк скелета (ADR 0060, SL5, SL13). */
export const getSkeletonRowCount = ({
  rowsCount,
  bodyHeight,
  rowHeight,
  pageSize,
}: SkeletonRowCountParams): number => {
  if (rowsCount !== 'auto') {
    return Math.max(0, Math.floor(rowsCount))
  }
  // Высота меньше строки — область растёт по содержимому, считать не из чего.
  const fit =
    rowHeight > 0 && bodyHeight >= rowHeight
      ? Math.ceil(bodyHeight / rowHeight)
      : SKELETON_ROWS_COUNT
  return pageSize !== undefined && pageSize > 0 ? Math.min(fit, pageSize) : fit
}

/**
 * Длина полоски скелета в колонке, % ширины (ADR 0060, SL7): своя у колонки,
 * одинаковая во всех строках — от id колонки, в диапазоне 40–90.
 */
export const getSkeletonBarWidth = (columnId: string): number => {
  let hash = 0
  for (let i = 0; i < columnId.length; i++) {
    hash = (hash * 31 + columnId.charCodeAt(i)) | 0
  }
  return 40 + (Math.abs(hash) % 51)
}

/** Идёт первая загрузка: грид и компоненты панелей показывают скелет (ADR 0060). */
export const isSkeletonShown = (table: unknown): boolean =>
  (table as { options: { loading?: unknown } }).options.loading === 'initial'
