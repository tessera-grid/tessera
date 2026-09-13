// Cutover (grid) — v9-порт BodyCell. Ячейка тела: пиннинг-стили/атрибуты (start/end),
// skeleton при fast-scroll, слоты, контент через нативный flexRender.
// Отличия от v8: самописный cell.renderComponent убран (контент рисует flexRender от
// columnDef.cell); пиннинг start/end через getCellPinningParams; переиспользуем
// v8-независимые CellWrapper/Skeleton/fastScroll. TODO(cutover): ветка
// rowActions-колонки (ActionsZone) портируется отдельно.
import { memo, useMemo } from 'react'

import { flexRender } from '@tanstack/table-v9'
import clsx from 'clsx'

import { useFastScrollSuppressed } from '../../lib/core/fastScroll'
import {
  CellWrapperContent,
  getAlignContent,
} from '../../lib/grid/CellWrapperContent'
import { CellWrapperTitle } from '../../lib/grid/CellWrapperTitle'
import { Skeleton } from '../../lib/ui/Skeleton'
import type { Cell } from '../types'
import { RenderSlot } from '../core/renderSlots'
import type { RegisterSlotParams } from '../core/createSlots'
import { getCellPinningParams } from './cellPinningParams'
import { getCellExpandingStyles } from './cellExpandingStyles'
import { getColumnSizeVariable } from './columnSizes'

import styles from '../../lib/grid/BodyCell/BodyCell.module.css'

interface TableBodyCellProps {
  layout: 'grid' | 'flex'
  cell: Cell<any, any, unknown>
  rowIndex: number
  leftCellSlot?: RegisterSlotParams<any>[]
  rightCellSlot?: RegisterSlotParams<any>[]
  actionRowSlot?: RegisterSlotParams<any>[]
  interact?: boolean
}

export const BodyCell = memo(
  ({
    layout,
    cell,
    rowIndex,
    leftCellSlot,
    rightCellSlot,
    interact = true,
  }: TableBodyCellProps) => {
    const table = cell.getContext().table

    const {
      isStartPinned,
      isEndPinned,
      isLastStartPinnedColumn,
      isLastEndPinnedColumn,
      isFirstEndPinnedColumn,
      isAloneEndPinnedColumn,
      startPinnedOffset,
      endPinnedOffset,
    } = getCellPinningParams(table as never, cell.column as never)

    const { paddingLeft } = getCellExpandingStyles({
      column: cell.column as never,
      rowDepth: cell.row.depth,
      table: table as never,
    })

    const isPinnedColumn = cell.column.getIsPinned()
    const isActionsColumn = cell.column.getIsActionsColumn()

    const isSuppressed = useFastScrollSuppressed()
    const showSkeleton = isSuppressed && !isActionsColumn && !isPinnedColumn
    const canRenderSlots = !isActionsColumn && !showSkeleton

    const render = useMemo(() => {
      if (showSkeleton) {
        return <Skeleton width="50%" height={16} animation={false} />
      }
      if (isSuppressed) {
        return null
      }

      const content = flexRender(cell.column.columnDef.cell, cell.getContext())

      // Сервисная колонка — контент без CellWrapperTitle.
      return isActionsColumn ? content : <CellWrapperTitle>{content}</CellWrapperTitle>
    }, [cell, isActionsColumn, isSuppressed, showSkeleton])

    return (
      <div
        role="cell"
        className={clsx('data-grid__body-cell', styles.body__cell)}
        style={{
          minWidth: `var(${getColumnSizeVariable(cell.column.id)})`,
          width: `var(${getColumnSizeVariable(cell.column.id)})`,
          left: startPinnedOffset,
          right: endPinnedOffset,
          paddingLeft,
        }}
        aria-colindex={cell.column.getIndex() + 1}
        data-column-id={cell.column.id}
        data-cell-pinned={isPinnedColumn}
        data-cell-odd-left-pinned={isStartPinned && rowIndex % 2 !== 0}
        data-cell-odd-right-pinned={isEndPinned && rowIndex % 2 !== 0}
        data-cell-last-left-pinned={isLastStartPinnedColumn}
        data-cell-last-right-pinned={isLastEndPinnedColumn}
        data-cell-first-right-pinned={isFirstEndPinnedColumn}
        data-cell-alone-right-pinned={isAloneEndPinnedColumn}
        data-actions-column-cell={isActionsColumn}
        data-cell-interact={interact}
        data-layout={layout}
        data-first-cell-in-row={cell.column.getIsFirstColumn()}
        data-last-cell-in-row={cell.column.getIsLastColumn()}
        data-cell-of-first-row={cell.row.getIsFirstRow()}
        data-cell-of-last-row={cell.row.getIsLastRow()}
      >
        <CellWrapperContent
          flex={getAlignContent({
            isActionsColumn,
            isRowActionsColumn: cell.column.getIsRowActionsColumn(),
          })}
          smallPadding={isActionsColumn}
        >
          {canRenderSlots && (
            <RenderSlot slot={leftCellSlot} context={cell.getContext()} />
          )}
          {render}
          {canRenderSlots && (
            <RenderSlot slot={rightCellSlot} context={cell.getContext()} />
          )}
        </CellWrapperContent>
      </div>
    )
  },
)

BodyCell.displayName = 'BodyCell'
