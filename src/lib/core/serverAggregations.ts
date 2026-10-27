/**
 * Агрегаты колонок для сервера (ADR 0144, §1): колонка → имя её `aggregationFn`. Только явные
 * строковые: умолчание TanStack `'auto'` выбирает функцию по данным клиента.
 */
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
    ).flatMap(({ id, columnDef }) =>
      typeof columnDef.aggregationFn === 'string' &&
      columnDef.aggregationFn !== 'auto'
        ? [[id, columnDef.aggregationFn]]
        : [],
    ),
  )
