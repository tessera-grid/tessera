import { memo, useMemo, useRef } from 'react'

import { Cell, CellContext, flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { getColumnSizeVariable } from '../../core/createColumns/calculateColumnSizes'
import { RegisterSlotParams } from '../../core/createSlots'
import { useFastScrollState } from '../../core/fastScroll'
import { RenderSlot } from '../../core/renderSlots'
import { useCellPinningParams } from '../../plugins/columnPinning'
import { getCellExpandingStyles } from '../../plugins/rowExpanding'
import { CellWrapperContent, getAlignContent } from '../CellWrapperContent'
import { CellWrapperTitle } from '../CellWrapperTitle'
import { Skeleton } from '../../ui/Skeleton'

import styles from './BodyCell.module.css'

interface TableBodyCellProps {
  layout: 'grid' | 'flex'

  cell: Cell<any, unknown>
  rowIndex: number

  leftCellSlot?: RegisterSlotParams<CellContext<any, unknown>>[]
  rightCellSlot?: RegisterSlotParams<CellContext<any, unknown>>[]
  actionRowSlot?: RegisterSlotParams<CellContext<any, unknown>>[]

  interact?: boolean
}

/**
 * @description
 * Компонент ячейки тела таблицы.
 * Может включать в себя базовую стилизацию и стилизацию расширений,
 * подключения системных расширений, а также управление отображением инжектируемого контента.
 */
export const BodyCell = memo(
  ({
    layout,

    cell,
    rowIndex,

    leftCellSlot,
    rightCellSlot,
    actionRowSlot,

    interact = true,
  }: TableBodyCellProps) => {
    const {
      isLeftPinned,
      isRightPinned,
      isLastLeftPinnedColumn,
      isLastRightPinnedColumn,
      isFirstRightPinnedColumn,
      isAloneRightPinnedColumn,
      getStartLeft,
      getAfterRight,
    } = useCellPinningParams({ column: cell.column })

    const { paddingLeft } = getCellExpandingStyles({
      column: cell.column,
      rowDepth: cell.row.depth,
      table: cell.getContext().table,
    })

    const isPinnedColumn = cell.column.getIsPinned()
    const isActionsColumn = cell.column.getIsActionsColumn()
    const isRowActionsColumn = cell.column.getIsRowActionsColumn()

    const { isFastScrolling, sessionId } = useFastScrollState()
    const mountedInSession = useRef(sessionId).current

    const isSuppressed = isFastScrolling && mountedInSession === sessionId
    const showSkeleton = isSuppressed && !isActionsColumn && !isPinnedColumn

    const canRenderSlots = !isActionsColumn && !showSkeleton

    const render = useMemo(() => {
      if (showSkeleton) {
        return <Skeleton width="50%" height={16} animation={false} />
      }

      if (isSuppressed) {
        return null
      }

      const RenderComponent = cell.renderComponent

      if (RenderComponent && isActionsColumn) {
        return <RenderComponent {...cell.getContext()} />
      }

      if (RenderComponent) {
        return (
          <CellWrapperTitle>
            <RenderComponent {...cell.getContext()} />
          </CellWrapperTitle>
        )
      }

      if (isRowActionsColumn) {
        return <RenderSlot slot={actionRowSlot} context={cell.getContext()} />
      }

      if (isActionsColumn) {
        return flexRender(
          cell.render || cell.column.columnDef.cell,
          cell.getContext(),
        )
      }

      return (
        <CellWrapperTitle>
          {flexRender(
            cell.render || cell.column.columnDef.cell,
            cell.getContext(),
          )}
        </CellWrapperTitle>
      )
    }, [
      actionRowSlot,
      cell,
      isActionsColumn,
      isRowActionsColumn,
      isSuppressed,
      showSkeleton,
    ])

    return (
      <div
        className={clsx('data-grid__body-cell', styles.body__cell)}
        style={{
          minWidth: `var(${getColumnSizeVariable(cell.column.id)})`,
          width: `var(${getColumnSizeVariable(cell.column.id)})`,
          left: isLeftPinned ? `${getStartLeft}px` : undefined,
          right: isRightPinned ? `${getAfterRight}px` : undefined,
          paddingLeft,
        }}
        aria-colindex={cell.column.getIndex()}
        data-cell-pinned={cell.column.getIsPinned()}
        data-cell-odd-left-pinned={isLeftPinned && rowIndex % 2 !== 0}
        data-cell-last-left-pinned={isLastLeftPinnedColumn}
        data-cell-last-right-pinned={isLastRightPinnedColumn}
        data-cell-first-right-pinned={isFirstRightPinnedColumn}
        data-cell-alone-right-pinned={isAloneRightPinnedColumn}
        data-actions-column-cell={isActionsColumn}
        data-cell-interact={interact}
        data-layout={layout}
        data-first-cell-in-row={cell.column.getIsFirstColumn()}
        data-last-cell-in-row={cell.column.getIsLastColumn()}
        data-cell-of-first-row={cell.row.getIsFirstRow()}
        data-cell-of-last-row={cell.row.getIsLastRow()}
      >
        <CellWrapperContent
          flex={getAlignContent({ isActionsColumn, isRowActionsColumn })}
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
