import { memo } from 'react'

import { Table } from '@tanstack/react-table'
import clsx from 'clsx'

import { useSkeletonParams } from '../../core/skeletonOverlay/parameters'
import { SkeletonBody } from './SkeletonBody'
import { SkeletonHead } from './SkeletonHead'

import dataGridStyles from '../DataGrid/DataGrid.module.css'

export interface SkeletonOverlayProps {
  table: Table<any>
  columnSizes: Record<string, string>
}

export const SkeletonOverlay = memo(
  ({ table, columnSizes }: SkeletonOverlayProps) => {
    const {
      columnsId,
      skeletonColumnsCount,
      skeletonRowsCount,
      skeletonLayout,
      needCalculateSkeletonSizes,
    } = useSkeletonParams({ table })

    return (
      <div
        role="table"
        className={clsx('MuiTable-root', dataGridStyles.table)}
        style={{
          ...columnSizes,
        }}
      >
        <SkeletonHead
          layout={skeletonLayout}
          calculateSize={needCalculateSkeletonSizes}
          columnsId={columnsId}
          columnsCount={skeletonColumnsCount}
        />
        <SkeletonBody
          layout={skeletonLayout}
          calculateSize={needCalculateSkeletonSizes}
          columnsId={columnsId}
          columnsCount={skeletonColumnsCount}
          rowsCount={skeletonRowsCount}
        />
      </div>
    )
  },
)

SkeletonOverlay.displayName = 'SkeletonOverlay'
