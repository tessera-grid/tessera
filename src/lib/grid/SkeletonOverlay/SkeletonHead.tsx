import { memo } from 'react'

import { getHeaderSizeVariable } from '../../core/createColumns/calculateColumnSizes'
import { SkeletonOptions } from '../../core/skeletonOverlay/types'
import { CellWrapperContent } from '../CellWrapperContent'
import { SkeletonCell } from './SkeletonCell'
import { SKELETON_MAX_WIDTH, SKELETON_MIN_WIDTH } from './skeletonSize'

export interface SkeletonHeadProps {
  layout: SkeletonOptions['layout']
  calculateSize?: boolean
  columnsId?: string[]
  columnsCount: number
}

/**
 * @description
 * Упрощенная версия оригинального компонента Head.tsx, повторяющая его структуру, но предназначенная только для отображения скелетов.
 */
export const SkeletonHead = memo(
  ({
    layout,
    calculateSize,
    columnsId = [],
    columnsCount,
  }: SkeletonHeadProps) => {
    return (
      <div className="data-grid__head--skeleton" style={{ display: 'grid' }}>
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
