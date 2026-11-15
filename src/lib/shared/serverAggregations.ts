/**
 * Агрегаты колонок для сервера (ADR 0144, §1): колонка → имя её `aggregationFn`. Только явные
 * строковые: умолчание TanStack `'auto'` выбирает функцию по данным клиента, а функцию и список
 * серверу не передать — о них предупреждение (GS15).
 */
import { logWarn } from '../util/logger'

interface AggregationColumn {
  id: string
  columnDef: { aggregationFn?: unknown }
}

export const serverAggregationsOf = (table: unknown): Record<string, string> =>
  Object.fromEntries(
    (
      (
        table as { getAllLeafColumns?: () => AggregationColumn[] }
      ).getAllLeafColumns?.() ?? []
    ).flatMap(({ id, columnDef }) => {
      const { aggregationFn } = columnDef
      if (typeof aggregationFn === 'string') {
        return aggregationFn === 'auto' ? [] : [[id, aggregationFn]]
      }
      // Своя функция сводки уходит серверу своим именем (ADR 0230, §2).
      const named =
        typeof aggregationFn === 'object'
          ? (aggregationFn as { name?: unknown } | null)?.name
          : undefined
      if (typeof named === 'string') return [[id, named]]
      if (aggregationFn !== undefined) {
        logWarn(
          table as never,
          `serverRowModel: column "${id}" has a non-string aggregationFn: the server gets only names`,
          `serverRowModel:aggregationFn:${id}`,
        )
      }
      return []
    }),
  )

/** Колонки с агрегатом по всем узлам дерева (ADR 0229, §7): колонка → `'all'`. */
export const serverAggregationScopesOf = (
  table: unknown,
): Record<string, 'all'> =>
  Object.fromEntries(
    (
      (
        table as {
          getAllLeafColumns?: () => (AggregationColumn & {
            columnDef: { aggregationScope?: unknown }
          })[]
        }
      ).getAllLeafColumns?.() ?? []
    )
      .filter(({ columnDef }) => columnDef.aggregationScope === 'all')
      .map(({ id }) => [id, 'all' as const]),
  )
