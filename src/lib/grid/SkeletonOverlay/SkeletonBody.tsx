import { memo } from 'react'

import { getColumnSizeVariable } from '../../core/createColumns/calculateColumnSizes'
import { SkeletonOptions } from '../../core/skeletonOverlay/types'
import { CellWrapperContent } from '../CellWrapperContent'
import { BackgroundRow } from './BackgroundRow'
import { SkeletonCell } from './SkeletonCell'
import { SKELETON_MAX_WIDTH, SKELETON_MIN_WIDTH } from './skeletonSize'

export interface SkeletonBodyProps {
  layout: SkeletonOptions['layout']
  calculateSize?: boolean
  columnsId?: string[]
  columnsCount: number
  rowsCount: number
}

/**
 * @description
 * Упрощенная версия оригинального компонента Body.tsx, повторяющая его структуру, но предназначенная только для отображения скелетов.
 */
export const SkeletonBody = memo(
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
        style={{
          display: 'grid',
          position: 'relative',
        }}
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
