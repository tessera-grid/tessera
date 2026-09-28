// SkeletonOverlay: упрощённые Head/Body только для скелетонов первой загрузки.
// Параметры (кол-во/раскладка/ширины) — useSkeletonParams.
import { type PropsWithChildren, memo } from 'react'

import clsx from 'clsx'

import { CellWrapperContent } from '../grid/CellWrapperContent'
import { Skeleton } from '../ui/Skeleton'
import type { Table } from '../types'
import type { SkeletonOptions } from '../core/skeletonOptions'
import { useSkeletonParams } from '../core/skeletonOverlay'
import { useLocalization } from '../core/localization'
import { getColumnSizeVariable, getHeaderSizeVariable } from './columnSizes'

import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'
import backgroundRowStyles from '../grid/SkeletonOverlay/BackgroundRow.module.css'

const SKELETON_MIN_WIDTH = 100
const SKELETON_MAX_WIDTH = 150

const SkeletonCell = memo(() => {
  return <Skeleton width="100%" height={16} animation="wave" />
})
SkeletonCell.displayName = 'SkeletonCell'

interface BackgroundRowProps {
  rowIndex: number
}

const BackgroundRow = memo(
  ({ rowIndex, children }: PropsWithChildren<BackgroundRowProps>) => {
    return (
      <div
        className={clsx(
          'data-grid__body-row--skeleton',
          backgroundRowStyles['body-row--skeleton'],
          {
            [backgroundRowStyles['body-row--skeleton-odd']]: rowIndex % 2 === 0,
          },
        )}
      >
        {children}
      </div>
    )
  },
)
BackgroundRow.displayName = 'BackgroundRow'

interface SkeletonHeadProps {
  layout: SkeletonOptions['layout']
  calculateSize?: boolean
  columnsId?: string[]
  columnsCount: number
}

const SkeletonHead = memo(
  ({
    layout,
    calculateSize,
    columnsId = [],
    columnsCount,
  }: SkeletonHeadProps) => {
    return (
      <div
        className="data-grid__head--skeleton"
        style={{ display: 'grid' }}
        aria-hidden="true"
      >
        <div
          className="data-grid__head-row--skeleton"
          style={{
            display: 'flex',
            width: '100%',
            outline: 0,
            top: 0,
            position: 'relative',
            boxShadow: 'rgba(0, 0, 0, 0.1) 4px 0px 8px',
          }}
        >
          {new Array(columnsCount).fill(null).map((_, colIndex) => {
            const widthStyles =
              calculateSize && Array.isArray(columnsId)
                ? {
                    width: `var(${getHeaderSizeVariable(columnsId[colIndex])})`,
                  }
                : {
                    flex: 1,
                    minWidth: SKELETON_MIN_WIDTH,
                    maxWidth:
                      layout === 'grid' ? SKELETON_MAX_WIDTH : undefined,
                  }

            return (
              <div
                key={`head-cell-${colIndex}`}
                className="data-grid__head-cell--skeleton"
                style={{
                  display: 'flex',
                  ...widthStyles,
                  padding: 0,
                  border: 'none',
                }}
              >
                <CellWrapperContent>
                  <SkeletonCell />
                </CellWrapperContent>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
SkeletonHead.displayName = 'MemoizedSkeletonHead'

interface SkeletonBodyProps extends SkeletonHeadProps {
  rowsCount: number
}

const SkeletonBody = memo(
  ({
    layout,
    calculateSize,
    columnsId = [],
    columnsCount,
    rowsCount,
  }: SkeletonBodyProps) => {
    return (
      <div
        className="data-grid__body--skeleton"
        aria-hidden="true"
        style={{ display: 'grid', position: 'relative' }}
      >
        {new Array(rowsCount).fill(null).map((_, rowIndex) => (
          <BackgroundRow
            key={`body-row--skeleton-${rowIndex}`}
            rowIndex={rowIndex}
          >
            {new Array(columnsCount).fill(null).map((__, colIndex) => {
              const widthStyles =
                calculateSize && Array.isArray(columnsId)
                  ? {
                      width: `var(${getColumnSizeVariable(columnsId[colIndex])})`,
                    }
                  : {
                      flex: 1,
                      minWidth: SKELETON_MIN_WIDTH,
                      maxWidth:
                        layout === 'grid' ? SKELETON_MAX_WIDTH : undefined,
                    }

              return (
                <div
                  key={`body-cell--skeleton-${colIndex}`}
                  className="data-grid__body-cell--skeleton"
                  style={{ ...widthStyles }}
                >
                  <CellWrapperContent>
                    <SkeletonCell />
                  </CellWrapperContent>
                </div>
              )
            })}
          </BackgroundRow>
        ))}
      </div>
    )
  },
)
SkeletonBody.displayName = 'MemoizedSkeletonBody'

export interface SkeletonOverlayProps {
  table: Table<any, any>
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
    const labels = useLocalization()

    return (
      <div
        className={clsx('data-grid__table', dataGridStyles.table)}
        style={{ ...columnSizes }}
      >
        <span role="status" className={dataGridStyles['visually-hidden']}>
          {labels.loading}
        </span>
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
