/**
 * Преобразования колонок — факт ядра (ADR 0204, §2): что плагин делает с данными по колонке —
 * сортирует, фильтрует, группирует — и как это снять. Плагин вкладывает запись полем
 * `columnTransforms`; меню «Колонки», кебаб и сводки читают только факт, не зная плагинов.
 */
import type { DebugActionSource } from './debugActions'
import type { TableLabels } from './localization'

/** Преобразование колонки сейчас. */
export interface ColumnTransformState {
  /** Направление сортировки. */
  direction?: 'asc' | 'desc'
  /** Место среди преобразований вида, с 1: приоритет сортировки, уровень группировки. */
  index?: number
  /** Всего преобразований вида: номер приоритета показывают, только если их больше одного. */
  count?: number
}

export interface ColumnTransform {
  /** Вид: `'sort'`, `'filter'`, `'group'` или свой вид плагина автора. */
  kind: string
  /** Преобразование колонки; `undefined` — колонку оно не трогает. */
  of: (table: unknown, columnId: string) => ColumnTransformState | undefined
  /** Название вида для перечня — «сортировка», «фильтр» (ADR 0204, §3). */
  name: (labels: TableLabels) => string
  /** Состояние для доступного имени — «по убыванию, приоритет 2 из 3». */
  describe: (labels: TableLabels, state: ColumnTransformState) => string
  /** Ключ значка в `icons` по состоянию — `sortDesc`, `filterActive`. */
  icon: (state: ColumnTransformState) => string
  /**
   * Снять преобразование колонок тем же путём, что и действие пользователя плагина: серверный
   * режим с откатом, канал действий с источником `source`.
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
