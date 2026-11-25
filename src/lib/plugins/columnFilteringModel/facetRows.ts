import {
  createFacetedRowModel,
  type ColumnFiltersState,
} from '@tanstack/react-table'

import { dataModeOf } from '../../core/dataMode'
import { rowsOf } from '../../core/rowEngine/rows'
import { isSearchAwareFilterStage } from '../../shared/rowModels/filteredRowModel'

export const builtInFacetedRowModel = createFacetedRowModel()

interface FacetTable {
  options: {
    features?: { facetedRowModel?: unknown; filteredRowModel?: unknown }
    manualFiltering?: boolean
  }
  atoms: {
    columnFilters?: { get: () => ColumnFiltersState | undefined }
    globalFilter?: { get: () => unknown }
  }
}

/** Счётчику нужны строки, полученные с теми же эффективными условиями (ADR 0237). */
export const reusableFacetRows = <TRow>(table: unknown, columnId: string) => {
  const grid = table as FacetTable
  const { features, manualFiltering } = grid.options
  if (
    features?.facetedRowModel !== builtInFacetedRowModel ||
    !isSearchAwareFilterStage(features.filteredRowModel) ||
    manualFiltering ||
    dataModeOf(grid, 'search') === 'server'
  )
    return undefined
  const filters = grid.atoms.columnFilters?.get()
  const query = grid.atoms.globalFilter?.get()
  if (
    (!filters?.length && (query == null || query === '')) ||
    columnId === '__global__' ||
    filters?.some(filter => filter.id === columnId)
  )
    return undefined
  return rowsOf<TRow>(grid, 'filtered').flatRows
}
