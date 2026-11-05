/**
 * Запись плагина columnTotals на `definePlugin` (ADR 0184): итог колонки в футере на клиенте.
 * Считает `column.getAggregationValue()` — строки после фильтров и поиска на всех страницах;
 * в серверной модели итог приходит с ответом, ядро читает его из источника строк.
 */
import { partialRowsReason } from '../../core/dataMode'
import { definePlugin } from '../../core/definePlugin'
import { aggregationFeatures } from '../../shared/aggregation'

export interface ColumnTotalsOptions {
  /** `false` — плагин отключён. */
  enabled?: boolean
}

interface TotalColumn {
  columnDef: { aggregationFn?: unknown }
  getAggregationValue: () => unknown
}

interface TotalTable {
  options: { enableFooter?: boolean }
  getColumn: (columnId: string) => TotalColumn | undefined
}

/** Страница с сервера и лента: у грида часть строк, их сумма — не итог (§5). */
const hasOnlyPartOfRows = (table: unknown) => {
  const reason = partialRowsReason(table)
  return reason === 'serverPage' || reason === 'feed'
}

/** Итог только у явного агрегата: `'auto'` суммировал бы и числовой id (§3). */
const columnTotalOf = (table: unknown, columnId: string): unknown => {
  if (partialRowsReason(table)) return undefined
  const column = (table as TotalTable).getColumn(columnId)
  const aggregationFn = column?.columnDef.aggregationFn
  if (aggregationFn === undefined || aggregationFn === 'auto') return undefined
  return column!.getAggregationValue()
}

export const columnTotals = definePlugin<ColumnTotalsOptions>()({
  id: 'columnTotals',
  diagnose: table => {
    if ((table as TotalTable).options.enableFooter === false) return 'noFooter'
    return hasOnlyPartOfRows(table) ? 'partialRows' : undefined
  },
  features: aggregationFeatures,
  // Отключённый плагин отдаёт нейтральное значение: v9 сливает опции с прежними.
  options: o => ({
    columnTotalOf: o.enabled === false ? undefined : columnTotalOf,
  }),
})
