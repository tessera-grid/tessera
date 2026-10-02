/**
 * Отфильтрованная модель строк для `columnFiltering` и `quickSearch` (ADR 0045).
 * Стоковый кэш смотрит только на срезы фильтров, а быстрый поиск идёт по видимым
 * колонкам: при активном поиске смена видимости пересобирает кэш.
 */
import { createFilteredRowModel } from '@tanstack/react-table'

import type { RowData, Table, TableFeatures } from '../types'

interface FilteringTable {
  atoms: {
    columnVisibility?: { get: () => unknown }
    globalFilter?: { get: () => unknown }
  }
}

const UNSET = Symbol('unset')

export const createSearchAwareFilteredRowModel =
  <TFeatures extends TableFeatures, TData extends RowData = any>() =>
  (table: Table<TFeatures, TData>) => {
    const { atoms } = table as unknown as FilteringTable
    let visibility: unknown = UNSET
    let rowModel = createFilteredRowModel<TFeatures, TData>()(table)
    return () => {
      const next = atoms.columnVisibility?.get()
      if (next !== visibility) {
        const searching = visibility !== UNSET && !!atoms.globalFilter?.get()
        visibility = next
        if (searching) {
          rowModel = createFilteredRowModel<TFeatures, TData>()(table)
        }
      }
      return rowModel()
    }
  }
