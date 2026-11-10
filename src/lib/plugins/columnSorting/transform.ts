/**
 * Сортировка колонки — запись факта преобразований (ADR 0204, §2): направление и приоритет;
 * снятие — как «Снять сортировку» в меню заголовка: серверное действие и канал действий.
 */
import type { ColumnTransform } from '../../core/columnTransforms'
import { reportAction } from '../../core/debugActions'
import { readPluginHooks } from '../../core/definePlugin'
import { runServerAction } from '../../core/serverActions'
import { columnSortingLabels } from './labels'
import type { ColumnSortingHooks } from './types'

interface SortEntry {
  id: string
  desc: boolean
}

interface SortingTable {
  atoms: { sorting?: { get: () => SortEntry[] | undefined } }
  setSorting: (sorting: SortEntry[]) => void
}

const sortingOf = (table: unknown): SortEntry[] =>
  (table as SortingTable).atoms.sorting?.get() ?? []

export const sortTransform: ColumnTransform = {
  kind: 'sort',
  name: labels => columnSortingLabels(labels).transformName,
  describe: (labels, { direction, index, count }) => {
    const sorted =
      direction === 'desc'
        ? columnSortingLabels(labels).transformDescending
        : columnSortingLabels(labels).transformAscending
    return count && count > 1 && index
      ? `${sorted}, ${columnSortingLabels(labels).transformPriority(index, count)}`
      : sorted
  },
  icon: ({ direction }) => (direction === 'desc' ? 'sortDesc' : 'sortAsc'),
  of: (table, columnId) => {
    const sorting = sortingOf(table)
    const index = sorting.findIndex(entry => entry.id === columnId)
    if (index < 0) return undefined
    return {
      direction: sorting[index]!.desc ? 'desc' : 'asc',
      index: index + 1,
      count: sorting.length,
    }
  },
  clear: (table, columnIds, source) => {
    const sorting = sortingOf(table)
    const next = sorting.filter(entry => !columnIds.includes(entry.id))
    if (next.length === sorting.length) return
    reportAction(table, {
      plugin: 'columnSorting',
      action: 'clearSort',
      detail: { columnIds: [...columnIds] },
      source,
    })
    const { onToggleColumnSort } = readPluginHooks<ColumnSortingHooks>(
      table as { getHooks: () => unknown },
      'columnSorting',
    )
    runServerAction(
      table,
      'sorting',
      () => (table as SortingTable).setSorting(next),
      context => {
        const results = columnIds.map(id =>
          onToggleColumnSort(id, false, context),
        )
        return results.some(result => result) ? Promise.all(results) : undefined
      },
      { control: 'columnSorting', columns: [...columnIds] },
    )
  },
}
