// OverlayBodyRow: строка в DragOverlay при перетаскивании строки (первая ячейка +
// drag-ручка + счётчик подстрок). Контент через flexRender.
import { forwardRef, memo } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { inertProp } from '../core/inertProp'
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
  forwardRef<HTMLDivElement, OverlayBodyRowProps>(
    ({ firstCell, withCount = false, subRowsCount = 0 }, ref) => {
      return (
        <div
          ref={ref}
          className={clsx(
            'data-grid-body__row',
            styles['body__row--overlay__container'],
          )}
          // Облако — визуальный клон: ни в дереве доступности, ни в фокусе (ADR 0006, D37).
          {...inertProp(true)}
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
          {withCount && (
            <Bubble className={styles.bubble}>{subRowsCount}</Bubble>
          )}
        </div>
      )
    },
  ),
)

OverlayBodyRow.displayName = 'OverlayBodyRow'
