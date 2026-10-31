/**
 * Отфильтрованная модель строк для `columnFiltering` и `quickSearch` (ADR 0045).
 * Стоковый кэш смотрит только на срезы фильтров, а быстрый поиск идёт по видимым
 * колонкам: при активном поиске смена видимости пересобирает кэш. Смена пояса дат
 * (`timeZone`, ADR 0047) при активных фильтрах колонок — тоже. Без фильтров и поиска
 * второй проход подряд строки не обходит (ADR 0068).
 */
import { createFilteredRowModel } from '@tanstack/react-table'

import type { RowData, Table, TableFeatures } from '../../types'
import { skipIdlePasses } from './idleRowModel'

interface FilteringTable {
  atoms: {
    columnVisibility?: { get: () => unknown }
    globalFilter?: { get: () => unknown }
    columnFilters?: { get: () => unknown[] | undefined }
  }
  options: { columnFilteringTimeZone?: string }
  getPreFilteredRowModel: () => unknown
  autoResetPageIndex?: () => void
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
    const searchValue = () => atoms.globalFilter?.get()
    const filtering = () => (atoms.columnFilters?.get()?.length ?? 0) > 0
    const searchAware = () => {
      const next = atoms.columnVisibility?.get()
      const nextTimeZone = t.options.columnFilteringTimeZone
      const searching = !!searchValue()
      const stale =
        (visibility !== UNSET && next !== visibility && searching) ||
        (timeZone !== UNSET && nextTimeZone !== timeZone && filtering())
      visibility = next
      timeZone = nextTimeZone
      if (stale) rowModel = createFilteredRowModel<TFeatures, TData>()(table)
      return rowModel()
    }
    return skipIdlePasses(
      searchAware,
      () => t.getPreFilteredRowModel() as ReturnType<typeof rowModel>,
      () => {
        const search = searchValue()
        return (
          !filtering() &&
          (search === undefined || search === null || search === '')
        )
      },
      () => t.autoResetPageIndex?.(),
    )
  }
