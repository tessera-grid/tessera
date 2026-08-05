import { useMemo } from 'react'

import { Table } from '@tanstack/react-table'

import { SKELETON_COLUMNS_COUNT, SKELETON_ROWS_COUNT } from './options'

export interface Parameters {
  table: Table<any>
}

export const useSkeletonParams = ({ table }: Parameters) => {
  const leafColumns = table.getVisibleLeafColumns()

  const columnsId = useMemo(() => {
    return leafColumns
      .filter(column => !column.getIsActionsColumn())
      .map(column => column.id)
  }, [leafColumns])

  const {
    columnsCount: _skeletonColumnsCount,
    rowsCount: _skeletonRowsCount,
    layout: skeletonLayout,
  } = table.options.skeletonOptions

  const skeletonColumnsCount =
    _skeletonColumnsCount === 'auto'
      ? columnsId.length || SKELETON_COLUMNS_COUNT
      : _skeletonColumnsCount

  const skeletonRowsCount =
    _skeletonRowsCount === 'auto'
      ? table.options.data.length || SKELETON_ROWS_COUNT
      : _skeletonRowsCount

  const needCalculateSkeletonSizes =
    _skeletonColumnsCount === 'auto' && skeletonLayout === 'grid'

  return {
    columnsId,
    skeletonColumnsCount,
    skeletonRowsCount,
    skeletonLayout,
    needCalculateSkeletonSizes,
  }
}
