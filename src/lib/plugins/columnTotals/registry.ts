/**
 * Запись плагина columnTotals на `definePlugin` (ADR 0184): итог колонки в футере на клиенте.
 * Считает `column.getAggregationValue()` — строки после фильтров и поиска на всех страницах;
 * в серверной модели итог приходит с ответом, ядро читает его из источника строк. Колонка
 * `aggregationScope: 'all'` складывает все строки дерева, аргумент `totals` — итоги приложения
 * (ADR 0229).
 */
import { partialRowsReason } from '../../core/dataMode'
import { definePlugin } from '../../core/definePlugin'
import {
  aggregatesAllNodes,
  aggregationFeatures,
  hasLazyChildren,
  withDescendants,
} from '../../shared/aggregation'
import { preGroupedModelOf } from '../../shared/rowModels/filteredRowModel'
import { logWarn } from '../../util/logger'

export interface ColumnTotalsOptions {
  /** `false` disables the plugin. */
  enabled?: boolean
  /**
   * Column totals the application knows (usually from the server): shown instead of the plugin's
   * computation, as text by the column type (ADR 0229, §6).
   */
  totals?: Record<string, unknown>
}

interface TotalRow {
  subRows: readonly TotalRow[]
}

interface TotalColumn {
  columnDef: { aggregationFn?: unknown }
  getAggregationValue: (options?: {
    rows?: readonly TotalRow[]
    maxDepth?: number
  }) => unknown
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

/** Итоги по всем узлам: на модель строк и колонку — один обход (AG2). */
const allNodesTotals = new WeakMap<
  object,
  Map<string, { aggregationFn: unknown; value: unknown }>
>()

const allNodesTotalOf = (
  table: TotalTable,
  columnId: string,
  column: TotalColumn,
) => {
  const model = preGroupedModelOf<TotalRow>(table)
  let byColumn = allNodesTotals.get(model)
  if (!byColumn) {
    byColumn = new Map()
    allNodesTotals.set(model, byColumn)
  }
  const { aggregationFn } = column.columnDef
  const cached = byColumn.get(columnId)
  if (cached && cached.aggregationFn === aggregationFn) return cached.value
  const rows = withDescendants(model.rows, row => row.subRows)
  // Глубина 0: плоский список уже содержит потомков, спуск посчитал бы их дважды.
  const value = column.getAggregationValue({ rows, maxDepth: 0 })
  byColumn.set(columnId, { aggregationFn, value })
  return value
}

/** Итог только у явного агрегата: `'auto'` суммировал бы и числовой id (§3). */
const columnTotalOf = (table: unknown, columnId: string): unknown => {
  if (partialRowsReason(table)) return undefined
  const column = (table as TotalTable).getColumn(columnId)
  const aggregationFn = column?.columnDef.aggregationFn
  if (aggregationFn === undefined || aggregationFn === 'auto') return undefined
  if (!aggregatesAllNodes(column!.columnDef)) {
    return column!.getAggregationValue()
  }
  // Ленивое дерево: сумма загруженных строк выглядела бы итогом (ADR 0229, §5).
  if (hasLazyChildren(table)) {
    logWarn(
      table as never,
      `columnTotals: column "${columnId}" sums all tree nodes, but some children are not loaded: pass the server's total with columnTotals({ totals })`,
      `columnTotals:lazyAllNodes:${columnId}`,
    )
    return undefined
  }
  return allNodesTotalOf(table as TotalTable, columnId, column!)
}

type TotalOf = ((table: unknown, columnId: string) => unknown) & {
  /** Итоги дало приложение: при части строк плагин не инертен. */
  fromApp?: boolean
}

/** Итог аргумента главнее подсчёта: его знает приложение (ADR 0229, §6). */
const columnTotalsWith = (totals: Record<string, unknown> | undefined) => {
  const totalOf: TotalOf = (table, columnId) =>
    totals && Object.hasOwn(totals, columnId)
      ? totals[columnId]
      : columnTotalOf(table, columnId)
  totalOf.fromApp = !!totals && Object.keys(totals).length > 0
  return totalOf
}

export const columnTotals = definePlugin<ColumnTotalsOptions>()({
  id: 'columnTotals',
  diagnose: table => {
    const { options } = table as TotalTable & {
      options: { columnTotalOf?: TotalOf }
    }
    if (options.enableFooter === false) return 'noFooter'
    return hasOnlyPartOfRows(table) && !options.columnTotalOf?.fromApp
      ? 'partialRows'
      : undefined
  },
  features: aggregationFeatures,
  // Отключённый плагин отдаёт нейтральное значение: v9 сливает опции с прежними. Новые итоги
  // аргумента — новая функция: по ней футер перерисовывает ячейки (AG8).
  options: o => ({
    columnTotalOf: o.enabled === false ? undefined : columnTotalsWith(o.totals),
  }),
})
