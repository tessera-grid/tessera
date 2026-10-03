/**
 * Отфильтрованная модель строк для `columnFiltering` и `quickSearch` (ADR 0045).
 * Стоковый кэш смотрит только на срезы фильтров, а быстрый поиск идёт по видимым
 * колонкам: при активном поиске смена видимости пересобирает кэш. Смена пояса дат
 * (`timeZone`, ADR 0047) при активных фильтрах колонок — тоже.
 */
import { createFilteredRowModel } from '@tanstack/react-table'

import type { RowData, Table, TableFeatures } from '../types'

interface FilteringTable {
  atoms: {
    columnVisibility?: { get: () => unknown }
    globalFilter?: { get: () => unknown }
    columnFilters?: { get: () => unknown[] | undefined }
  }
  options: { columnFilteringTimeZone?: string }
}

const UNSET = Symbol('unset')

export const createSearchAwareFilteredRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const t = table as unknown as FilteringTable
    const { atoms } = t
    let visibility: unknown = UNSET
    let timeZone: unknown = UNSET
    let rowModel = createFilteredRowModel<TFeatures, TData>()(table)
    return () => {
      const next = atoms.columnVisibility?.get()
      const nextTimeZone = t.options.columnFilteringTimeZone
      const searching = !!atoms.globalFilter?.get()
      const filtering = (atoms.columnFilters?.get()?.length ?? 0) > 0
      const stale =
        (visibility !== UNSET && next !== visibility && searching) ||
        (timeZone !== UNSET && nextTimeZone !== timeZone && filtering)
      visibility = next
      timeZone = nextTimeZone
      if (stale) rowModel = createFilteredRowModel<TFeatures, TData>()(table)
      return rowModel()
    }
  }
