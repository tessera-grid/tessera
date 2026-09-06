import { memo } from 'react'

import { Cell, flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { Bubble } from '../../ui/Bubble'
import { DragHandler } from '../dnd'
import { CellWrapperContent } from '../CellWrapperContent'
import { CellWrapperTitle } from '../CellWrapperTitle'

import styles from './OverlayBodyRow.module.css'

interface OverlayBodyRowProps {
  firstCell: Cell<any>
  withCount?: boolean
  subRowsCount?: number
}

export const OverlayBodyRow = memo(
  ({ firstCell, withCount = false, subRowsCount = 0 }: OverlayBodyRowProps) => {
    return (
      <div
        className={clsx(
          'data-grid-body__row',
          styles['body__row--overlay__container'],
        )}
      >
        <div className={styles['body__row--overlay']}>
          <CellWrapperContent noPadding>
            <DragHandler id="" type="row" />
            <CellWrapperTitle>
              {flexRender(
                firstCell.render || firstCell.column.columnDef.cell,
                firstCell.getContext(),
              )}
            </CellWrapperTitle>
          </CellWrapperContent>
        </div>
        {withCount && <Bubble className={styles.bubble}>{subRowsCount}</Bubble>}
      </div>
    )
  },
)

OverlayBodyRow.displayName = 'OverlayBodyRow'
