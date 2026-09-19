// OverlayBodyRow: строка в DragOverlay при перетаскивании строки (первая ячейка +
// drag-ручка + счётчик подстрок). Контент через flexRender.
import { memo } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { Bubble } from '../ui/Bubble'
import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Cell } from '../types'
import { DragHandler } from './dnd'

import styles from '../grid/BodyRow/OverlayBodyRow.module.css'

interface OverlayBodyRowProps {
  firstCell: Cell<any, any, unknown>
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
                firstCell.column.columnDef.cell,
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
