// OverlayBodyRow: облако перетаскиваемой строки (первая ячейка + ручка + счётчик
// подстрок); его рисует грид по просьбе плагина перетаскивания (ADR 0168, §2).
import { type ReactNode, forwardRef, memo } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { inertProp } from '../core/inertProp'
import type { BodyBoundaryProps } from '../core/pluginWrappers'
import { Bubble } from '../ui/Bubble'
import { CellWrapperContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Cell } from '../types'

import styles from '../grid/BodyRow/OverlayBodyRow.module.css'

interface OverlayBodyRowProps {
  firstCell: Cell<any, any, unknown>
  withCount?: boolean
  subRowsCount?: number
  /** Ручка облака — от плагина. */
  handle: ReactNode
}

export const OverlayBodyRow = memo(
  forwardRef<HTMLDivElement, OverlayBodyRowProps>(
    ({ firstCell, withCount = false, subRowsCount = 0, handle }, ref) => {
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
              {handle}
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

/** Облако строки для обёртки тела плагина: первая ячейка данных и счётчик подстрок. */
export const renderRowCloud: BodyBoundaryProps['renderCloud'] = (
  row,
  { ref, handle },
) => {
  const firstCell = row
    .getVisibleCells()
    .find(cell => !cell.column.getIsActionsColumn())
  return firstCell ? (
    <OverlayBodyRow
      ref={ref}
      firstCell={firstCell}
      withCount={row.getCanExpand?.() ?? false}
      subRowsCount={row.subRows.length}
      handle={handle}
    />
  ) : null
}
