/** Подписи `columnSorting` (ADR 0182, §8): ключи словаря таблицы `columnSorting.<ключ>`. */
import { defineLabels } from '../../core/localization'

export interface ColumnSortingLabels {
  /** Тултип «сортировать по возрастанию» */
  sortAscending: string
  /** Тултип «сортировать по убыванию» */
  sortDescending: string
  /** Тултип «сбросить сортировку» */
  clearSort: string
  /**
   * Доступное имя приоритета столбца в мультисортировке (`position` из `total`,
   * 1-based). Уходит в `aria-label` кнопки — числовой бейдж приоритета скринридер
   * не читает, поэтому порядок сортировки проговаривается тут.
   */
  sortPriority: (position: number, total: number) => string
  /** Действие: сортировка колонки */
  actionSort: string
  /** Вид преобразования в перечне меню «Колонки» (ADR 0204) */
  transformName: string
  /** Сортировка скрытой колонки по возрастанию — в доступном имени её пункта */
  transformAscending: string
  /** То же по убыванию */
  transformDescending: string
  /** Приоритет сортировки скрытой колонки (`position` из `total`) */
  transformPriority: (position: number, total: number) => string
  /** Кнопка-сводка сортировки в тулбаре и заголовок её поповера (ADR 0204, §5) */
  sorting: string
  /** Снять уровень сортировки колонки в сводке */
  removeSort: (column: string) => string
  /** Сбросить всю сортировку в сводке */
  resetSorting: string
}

export const columnSortingLabels = defineLabels<ColumnSortingLabels>()(
  'columnSorting',
  {
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    clearSort: 'Clear sorting',
    sortPriority: 'Sort priority {position} of {total}',
    actionSort: 'Sort',
    transformName: 'sorting',
    transformAscending: 'sorted ascending',
    transformDescending: 'sorted descending',
    transformPriority: 'priority {position} of {total}',
    sorting: 'Sorting',
    removeSort: 'Remove sorting: {column}',
    resetSorting: 'Reset sorting',
  },
  {
    sortPriority: ['position', 'total'],
    transformPriority: ['position', 'total'],
    removeSort: ['column'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnSorting: typeof columnSortingLabels
  }
}
