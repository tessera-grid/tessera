/**
 * Сводка активных фильтров колонок (ADR 0045, §5): подпись колонки, текст условия и
 * признак скрытой колонки. Фильтр колонки, которой нет в описании, не показывается.
 */
import type { ColumnFilterValue } from './types'

interface SummaryColumn {
  id: string
  columnDef: { header?: unknown }
  getIsVisible?: () => boolean
}

interface SummaryTable {
  atoms: { columnFilters?: { get: () => { id: string; value: unknown }[] } }
  getColumn: (id: string) => SummaryColumn | undefined
}

export interface FilterSummaryItem {
  columnId: string
  header: string
  filter: ColumnFilterValue
  hidden: boolean
}

export const filterSummaryOf = (table: unknown): FilterSummaryItem[] => {
  const t = table as SummaryTable
  const items: FilterSummaryItem[] = []
  for (const { id, value } of t.atoms.columnFilters?.get() ?? []) {
    const column = t.getColumn(id)
    if (!column) continue
    const { header } = column.columnDef
    items.push({
      columnId: id,
      header: typeof header === 'string' ? header : id,
      filter: value as ColumnFilterValue,
      hidden: column.getIsVisible?.() === false,
    })
  }
  return items
}
