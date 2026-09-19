/**
 * grid-раскладка: getGridLayout (CSS grid template для вложенной шапки) и
 * useGridStyles (grid-позиция ячейки заголовка); getIsRowActionsColumn даёт
 * commonFeature.
 */
import { useMemo } from 'react'

import type { Column, Header, HeaderGroup } from '../types'

type RowActionsAware = { getIsRowActionsColumn: () => boolean }

export interface GetGridLayoutParams {
  layout: 'grid' | 'flex'
  headerGroups: HeaderGroup<any, any>[]
  leafColumns: Column<any, any, unknown>[]
}

export const getGridLayout = ({
  layout,
  headerGroups,
  leafColumns,
}: GetGridLayoutParams) => {
  if (layout === 'flex') {
    return undefined
  }

  const gridTemplateRows = `repeat(${headerGroups.length}, auto)`

  const isRowActions = (column: Column<any, any, unknown>) =>
    (column as unknown as RowActionsAware).getIsRowActionsColumn()

  const track = (column: Column<any, any, unknown>) =>
    isRowActions(column) ? '1fr' : 'auto'

  const gridTemplateColumns =
    leafColumns.at(-1) && isRowActions(leafColumns.at(-1)!)
      ? leafColumns.map(track).join(' ')
      : leafColumns.map(track).concat('1fr').join(' ')

  return { gridTemplateRows, gridTemplateColumns }
}

export const useGridStyles = (header: Header<any, any, unknown>) => {
  const rowSpan = (header.column.columnDef as { rowSpan?: number }).rowSpan

  const gridRow: string | number =
    typeof rowSpan === 'number' && rowSpan > 0
      ? `1 / span ${rowSpan}`
      : header.column.depth + 1
  const gridColumn = `span ${header.colSpan}`

  return useMemo(() => ({ gridRow, gridColumn }), [gridColumn, gridRow])
}
