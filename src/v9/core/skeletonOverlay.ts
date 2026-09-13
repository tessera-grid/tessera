import { useEffect, useMemo, useState } from 'react'

import type { Table } from '../types'
import {
  SKELETON_COLUMNS_COUNT,
  SKELETON_ROWS_COUNT,
  type SkeletonOptions,
} from './skeletonOptions'

/**
 * Флаг показа скелетон-оверлея: включён сразу при enableSkeleton, гаснет с
 * задержкой 200мс после выключения (плавное перекрытие с первым рендером данных).
 */
export const useSkeletonOverlayState = (enableSkeleton = false) => {
  const [showSkeletonOverlay, setShowSkeletonOverlay] = useState(enableSkeleton)

  useEffect(() => {
    if (enableSkeleton) {
      setShowSkeletonOverlay(true)

      return
    }

    const skeletonHideTimeout = setTimeout(
      () => setShowSkeletonOverlay(false),
      200,
    )

    return () => {
      clearTimeout(skeletonHideTimeout)
    }
  }, [enableSkeleton])

  return { showSkeletonOverlay }
}

export interface SkeletonParams {
  table: Table<any, any>
}

export const useSkeletonParams = ({ table }: SkeletonParams) => {
  const leafColumns = table.getVisibleLeafColumns()

  const columnsId = useMemo(() => {
    return leafColumns
      .filter((column: any) => !column.getIsActionsColumn())
      .map((column: any) => column.id)
  }, [leafColumns])

  const {
    columnsCount: _skeletonColumnsCount,
    rowsCount: _skeletonRowsCount,
    layout: skeletonLayout,
  } = (table.options as unknown as { skeletonOptions: SkeletonOptions })
    .skeletonOptions

  const skeletonColumnsCount =
    _skeletonColumnsCount === 'auto'
      ? columnsId.length || SKELETON_COLUMNS_COUNT
      : _skeletonColumnsCount

  const skeletonRowsCount =
    _skeletonRowsCount === 'auto'
      ? (table.options.data as unknown[]).length || SKELETON_ROWS_COUNT
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
