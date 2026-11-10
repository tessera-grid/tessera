/**
 * Фильтр колонки — запись факта преобразований (ADR 0204, §2); снятие — как снятие условия в
 * сводке «Фильтры»: серверное действие и канал действий.
 */
import type { ColumnTransform } from '../../core/columnTransforms'
import {
  columnFiltersOf,
  setColumnFiltersByUser,
} from '../../shared/filtering/filtering'
import { columnFilteringLabels } from './labels'

export const filterTransform: ColumnTransform = {
  kind: 'filter',
  name: labels => columnFilteringLabels(labels).transformName,
  describe: labels => columnFilteringLabels(labels).transformDescription,
  icon: () => 'filterActive',
  of: (table, columnId) =>
    columnFiltersOf(table).some(filter => filter.id === columnId)
      ? {}
      : undefined,
  clear: (table, columnIds, source) => {
    const filters = columnFiltersOf(table)
    const next = filters.filter(filter => !columnIds.includes(filter.id))
    if (next.length !== filters.length)
      setColumnFiltersByUser(table, next, source)
  },
}
