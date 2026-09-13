// Cutover (grid) — v9-порт HeadCell (без drag-обвязки: DraggableHeadCell/useSortable
// требует DndContext и портируется на cutover в браузере). Пиннинг start/end по
// листьям ячейки-заголовка; контент через flexRender (самописный renderComponent
// убран); действия слотов — ActionsZone. Опциональные методы фич (sort/resize/drag)
// вызываются через ?. — плагина может не быть в наборе.
import { type CSSProperties, memo, useMemo } from 'react'

import { flexRender } from '@tanstack/table-v9'
import clsx from 'clsx'

import {
  CellWrapperContent,
  getAlignContent,
} from '../../lib/grid/CellWrapperContent'
import { CellWrapperTitle } from '../../lib/grid/CellWrapperTitle'
import type { Header } from '../types'
import type { RegisterSlotParams } from '../core/createSlots'
import { useTableState } from '../core/reactivity'
import { ActionsZone } from './headerActions/ActionsZone'
import { useGridStyles } from './layout'
import {
  getColumnSizeVariable,
  getHeaderSizeVariable,
  getPinnedEndOffset,
  getPinnedStartOffset,
} from './columnSizes'

import headCellStyles from '../../lib/grid/HeadCell/HeadCell.module.css'

interface TableHeadCellProps {
  layout: 'grid' | 'flex'
  header: Header<any, any, unknown>
  leftHeaderSlot?: RegisterSlotParams<any>[]
  rightHeaderSlot?: RegisterSlotParams<any>[]
}

const getAriaSort = (
  header: Header<any, any, unknown>,
): 'ascending' | 'descending' | 'none' | undefined => {
  if (!(header.column.getCanSort?.() ?? false)) {
    return undefined
  }
  const sorted = header.column.getIsSorted?.()
  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'
  return 'none'
}

export const HeadCell = memo(
  ({ layout, header, leftHeaderSlot, rightHeaderSlot }: TableHeadCellProps) => {
    const table = header.getContext().table

    // Коарс-подписка (TODO Phase D: сузить). Нужна для aria-sort/resizing/пиннинга.
    useTableState(table as never, (state: unknown) => state)

    // Пиннинг по листьям ЭТОЙ ячейки (reorder-out: сегмент закреплён, только если
    // все его листья закреплены на одной стороне). start/end (v9).
    const leafCols = header.getLeafHeaders().map(leaf => leaf.column)
    const firstLeaf = leafCols[0] ?? header.column
    const lastLeaf = leafCols.at(-1) ?? header.column
    const isStartPinned =
      leafCols.length > 0 && leafCols.every(c => c.getIsPinned() === 'start')
    const isEndPinned =
      leafCols.length > 0 && leafCols.every(c => c.getIsPinned() === 'end')
    const headerPinned = isStartPinned ? 'start' : isEndPinned ? 'end' : false

    const startCols = (table as any).getStartVisibleLeafColumns() as { id: string }[]
    const endCols = (table as any).getEndVisibleLeafColumns() as { id: string }[]
    const isLastStartPinnedColumn =
      isStartPinned && startCols.at(-1)?.id === lastLeaf.id
    const isFirstEndPinnedColumn =
      isEndPinned && endCols[0]?.id === firstLeaf.id

    const startPinnedOffset = isStartPinned
      ? getPinnedStartOffset(table as never, firstLeaf as never)
      : undefined
    const endPinnedOffset = isEndPinned
      ? getPinnedEndOffset(table as never, lastLeaf as never)
      : undefined

    const isActionsColumn = header.column.getIsActionsColumn()
    const enableResizingColumn = header.column.getCanResize?.() ?? false
    const isResizing = header.column.getIsResizing?.() ?? false
    const canRenderSlots = !isActionsColumn

    const render = useMemo(() => {
      const content = flexRender(header.column.columnDef.header, header.getContext())
      return isActionsColumn ? content : <CellWrapperTitle>{content}</CellWrapperTitle>
    }, [header, isActionsColumn])

    const gridStyles = useGridStyles(header)

    const cellStyles: CSSProperties = {
      ...gridStyles,
      minWidth: `var(${getHeaderSizeVariable(header.id)})`,
      width:
        header.column.getIsRowActionsColumn() && layout === 'grid'
          ? 'auto'
          : `var(${getColumnSizeVariable(header.id)})`,
      left: startPinnedOffset,
      right: endPinnedOffset,
    }

    if (header.isPlaceholder || (header.column.columnDef as { rowSpan?: number }).rowSpan === 0) {
      return null
    }

    return (
      <div
        style={cellStyles}
        className={clsx('data-grid__head-cell', headCellStyles.head__cell)}
        role="columnheader"
        aria-colindex={header.column.getIndex() + 1}
        aria-sort={getAriaSort(header)}
        data-column-id={header.column.id}
        data-cell-pinned={headerPinned}
        data-cell-last-left-pinned={isLastStartPinnedColumn}
        data-cell-first-right-pinned={isFirstEndPinnedColumn}
        data-column-resizable={enableResizingColumn}
        data-column-resizing={isResizing}
        data-actions-column-cell={isActionsColumn}
        data-layout={layout}
        data-first-headers-row={header.headerGroup?.getIsFirstGroup() ?? false}
        data-last-headers-row={header.headerGroup?.getIsLastGroup() ?? false}
        data-first-header-in-row={header.getIsFirstHeader()}
        data-last-header-in-row={header.getIsLastHeader()}
        data-header-full-height={header.getIsFullHeightHeader()}
      >
        <CellWrapperContent
          flex={getAlignContent({ isActionsColumn, isRowActionsColumn: false })}
          smallPadding={isActionsColumn}
        >
          {canRenderSlots && (
            <ActionsZone
              slot="leftHeaderSlot"
              opaqueSlot={leftHeaderSlot}
              context={header.getContext()}
            />
          )}
          {render}
          {canRenderSlots && (
            <ActionsZone
              slot="rightHeaderSlot"
              opaqueSlot={rightHeaderSlot}
              context={header.getContext()}
            />
          )}
        </CellWrapperContent>
      </div>
    )
  },
)

HeadCell.displayName = 'HeadCell'
