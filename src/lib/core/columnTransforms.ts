/**
 * Преобразования колонок — факт ядра (ADR 0204, §2): что плагин делает с данными по колонке —
 * сортирует, фильтрует, группирует — и как это снять. Плагин вкладывает запись полем
 * `columnTransforms`; меню «Колонки», кебаб и сводки читают только факт, не зная плагинов.
 */
import type { DebugActionSource } from './debugActions'
import type { TableLabels } from './localization'

/** A column's current transform. */
export interface ColumnTransformState {
  /** Sort direction. */
  direction?: 'asc' | 'desc'
  /** Place among view transforms, from 1: sort priority, grouping level. */
  index?: number
  /** Total view transforms: the priority number is shown only when there is more than one. */
  count?: number
}

export interface ColumnTransform {
  /** Kind: `'sort'`, `'filter'`, `'group'`, or a custom kind of an author's plugin. */
  kind: string
  /** The column's transform; `undefined` means it doesn't affect the column. */
  of: (table: unknown, columnId: string) => ColumnTransformState | undefined
  /** Kind name for the list — "sorting", "filter" (ADR 0204, §3). */
  name: (labels: TableLabels) => string
  /** State for the accessible name — "descending, priority 2 of 3". */
  describe: (labels: TableLabels, state: ColumnTransformState) => string
  /** Icon key in `icons` for the state — `sortDesc`, `filterActive`. */
  icon: (state: ColumnTransformState) => string
  /**
   * Removes the transform of columns the same way as the plugin's user action: server mode
   * with rollback, the debug-action channel with source `source`.
   */
  clear: (
    table: unknown,
    columnIds: readonly string[],
    source: DebugActionSource,
  ) => void
}

/** Преобразование колонки с его видом. */
export interface ActiveColumnTransform extends ColumnTransformState {
  kind: string
}

const NONE: readonly ColumnTransform[] = []

/** Записи преобразований включённых плагинов таблицы. */
export const columnTransformsOf = (
  table: unknown,
): readonly ColumnTransform[] =>
  (table as { options?: { columnTransforms?: ColumnTransform[] } }).options
    ?.columnTransforms ?? NONE

/** Что сейчас делают с колонкой включённые плагины — в порядке плагинов. */
export const transformsOfColumn = (
  table: unknown,
  columnId: string,
): ActiveColumnTransform[] => {
  const active: ActiveColumnTransform[] = []
  for (const transform of columnTransformsOf(table)) {
    const state = transform.of(table, columnId)
    if (state) active.push({ kind: transform.kind, ...state })
  }
  return active
}

/** Преобразование колонки для показа: название, описание и значок. */
export interface ShownColumnTransform extends ActiveColumnTransform {
  name: string
  description: string
  icon: string
}

/** Что делают с колонкой — с подписями и значками, для меню и объявлений. */
export const describeColumnTransforms = (
  table: unknown,
  columnId: string,
  labels: TableLabels,
): ShownColumnTransform[] => {
  const shown: ShownColumnTransform[] = []
  for (const transform of columnTransformsOf(table)) {
    const state = transform.of(table, columnId)
    if (!state) continue
    shown.push({
      kind: transform.kind,
      ...state,
      name: transform.name(labels),
      description: transform.describe(labels, state),
      icon: transform.icon(state),
    })
  }
  return shown
}

/** Снять все преобразования колонок — одним действием пользователя на каждый вид. */
export const clearColumnTransforms = (
  table: unknown,
  columnIds: readonly string[],
  source: DebugActionSource,
) => {
  for (const transform of columnTransformsOf(table)) {
    const touched = columnIds.filter(id => transform.of(table, id))
    if (touched.length > 0) transform.clear(table, touched, source)
  }
}
