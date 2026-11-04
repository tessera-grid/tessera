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
}

export const columnSortingLabels = defineLabels<ColumnSortingLabels>()(
  'columnSorting',
  {
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    clearSort: 'Clear sorting',
    sortPriority: 'Sort priority {position} of {total}',
    actionSort: 'Sort',
  },
  {
    sortPriority: ['position', 'total'],
  },
)

declare module '../../core/localization/pluginLabels' {
  interface PluginLabels {
    columnSorting: typeof columnSortingLabels
  }
}
