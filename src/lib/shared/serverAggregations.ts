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
