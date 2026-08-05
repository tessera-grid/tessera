import { Column, HeaderGroup } from '@tanstack/react-table'

export interface GetGridLayoutParams {
  layout: 'grid' | 'flex'
  headerGroups: HeaderGroup<any>[]
  leafColumns: Column<any, unknown>[]
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

  const gridTemplateColumns = leafColumns.at(-1)?.getIsRowActionsColumn()
    ? leafColumns
        .map(column => (column.getIsRowActionsColumn() ? '1fr' : 'auto'))
        .join(' ')
    : leafColumns
        .map(column => (column.getIsRowActionsColumn() ? '1fr' : 'auto'))
        .concat('1fr')
        .join(' ')

  return { gridTemplateRows, gridTemplateColumns }
}
