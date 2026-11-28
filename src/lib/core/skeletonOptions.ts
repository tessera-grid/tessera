import { hasLoadError } from './loadError'
import { rowSourceOf } from './rowSource'

export interface SkeletonOptions {
  /**
   * Skeleton rows: a number gives exactly that many; `'auto'` fits as many as the height allows
   * (with pagination — no more than the page size).
   */
  rowsCount?: number | 'auto'
  /** Skeleton columns when the grid has no columns of its own (`columns: []`). */
  columnsCount?: number
}

export const SKELETON_COLUMNS_COUNT = 8
/** Строк, если высоту области посчитать нельзя и пагинации нет. */
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
  const paged = pageSize !== undefined && pageSize > 0
  // Высота меньше строки — область растёт по содержимому, считать не из чего: строк —
  // страница, без пагинации — запасное число.
  if (rowHeight <= 0 || bodyHeight < rowHeight) {
    return paged ? pageSize : SKELETON_ROWS_COUNT
  }
  const fit = Math.ceil(bodyHeight / rowHeight)
  return paged ? Math.min(fit, pageSize) : fit
}

/** Вид ячейки скелета (ADR 0060, SL18): полоска, квадрат контрола или пусто. */
export type SkeletonCellKind = 'bar' | 'control' | 'toggle' | 'none'

/** Вид ячейки скелета: свой у колонки, иначе пусто у служебной и полоска у данных. */
export const getSkeletonCellKind = (
  skeletonCell: SkeletonCellKind | undefined,
  isServiceColumn: boolean,
): SkeletonCellKind => skeletonCell ?? (isServiceColumn ? 'none' : 'bar')

/** Id колонки скелета без колонок у грида (`columns: []`). */
export const getSkeletonColumnId = (index: number) => `skeleton-${index}`

/**
 * Длина полоски скелета в колонке, % ширины (ADR 0060, SL7, SL19): своя у колонки,
 * одинаковая во всех строках и во всех скелетах — от id колонки, в диапазоне 40–90.
 */
const hashOf = (text: string) => {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export const getSkeletonBarWidth = (columnId: string): number =>
  40 + (hashOf(columnId) % 51)

/** Строка дерева скелета (ADR 0060, SL22). */
export interface SkeletonTreeRow {
  depth: number
  /** Ветка для линий дерева: у подстроки `'1'` — следом сестра, `'0'` — последняя. */
  branch: string
  /** Следом идут подстроки этой строки. */
  open: boolean
  /** У строки есть подстроки — в колонке раскрытия квадрат. */
  parent: boolean
}

/** Подстрок у строки верхнего уровня: 0, 0, 1 или 2 — по хэшу её номера. */
const childrenOf = (parent: number) =>
  [0, 0, 1, 2][hashOf(`row-${parent}`) % 4]!

/**
 * У строки скелета есть подстроки — в колонке раскрытия квадрат (SL25). Тот же хэш
 * номера, что у плана дерева: в плоском скелете квадраты вразброс.
 */
export const isSkeletonParentRow = (index: number) => childrenOf(index) > 0

/** План `count` строк скелета дерева: одинаков при каждом расчёте. */
export const getSkeletonTreeRows = (count: number): SkeletonTreeRow[] => {
  const rows: SkeletonTreeRow[] = []
  for (let parent = 0; rows.length < count; parent++) {
    const children = childrenOf(parent)
    rows.push({
      depth: 0,
      branch: '',
      open: children > 0,
      parent: children > 0,
    })
    for (let child = 0; child < children; child++) {
      rows.push({
        depth: 1,
        branch: child < children - 1 ? '1' : '0',
        open: false,
        parent: false,
      })
    }
  }
  const plan = rows.slice(0, count)
  // Продолжение последней строки отрезано: ни отростка к детям, ни ветки к сестре.
  const last = plan.at(-1)
  if (last)
    plan[plan.length - 1] = { ...last, branch: last.branch && '0', open: false }
  return plan
}

/**
 * The first load is in progress: the grid and slot components show a skeleton (ADR 0060, SL21).
 * A failure without rows takes precedence — the error stub replaces the skeleton (ADR 0096, LE9).
 */
export const isSkeletonShown = (table: unknown): boolean => {
  const { options } = table as {
    options: { loading?: unknown; loadError?: unknown }
  }
  if (options.loading !== 'initial') return false
  return !(hasLoadError(options.loadError) && rowSourceOf(table).count() === 0)
}

/**
 * Первая загрузка, а колонок ещё нет — приложение получает их с сервера (`columns: []`):
 * контролам тулбара над колонками опереться не на что (ADR 0122, TF2–TF3).
 */
export const isWaitingForColumns = (table: unknown): boolean =>
  isSkeletonShown(table) &&
  (table as { getAllLeafColumns: () => unknown[] }).getAllLeafColumns()
    .length === 0
