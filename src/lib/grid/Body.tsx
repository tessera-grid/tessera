// Body: контейнер тела. Виртуализация приходит пропсами (virtualRows/virtualColumns
// считает DataGrid), Body лишь маппит строки в BodyRow/DraggableBodyRow. При
// enableRowDragging рисуется DraggableBodyRow (useSortable под DndContext тела),
// иначе обычная BodyRow.
import { memo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { Column, Row } from '../types'
import type { CellSlot } from '../core/createSlots'
import { BodyRow, DraggableBodyRow } from './BodyRow'

import styles from '../grid/Body/Body.module.css'

interface TableBodyProps {
  layout: 'grid' | 'flex'
  rows: Row<any, any>[]
  virtualRows: VirtualItem[]
  virtualColumns: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  cellSlot?: CellSlot
  actionRowSlot?: CellSlot
  headerRowCount: number
  selectableRows?: boolean
  isResizingColumns: false | string
  isVirtualColumns: boolean
  enableRowDragging?: boolean
}

export const Body = ({
  layout,
  rows,
  virtualRows,
  virtualColumns,
  leafColumns,
  leftCellSlot,
  rightCellSlot,
  cellSlot,
  actionRowSlot,
  headerRowCount,
  selectableRows,
  isVirtualColumns,
  enableRowDragging,
}: TableBodyProps) => {
  const RowComponent = enableRowDragging ? DraggableBodyRow : BodyRow

  return (
    <div
      className={clsx('data-grid__body', styles.body)}
      role="rowgroup"
      data-layout={layout}
    >
      {virtualRows.map(virtualRow => {
        const row = rows[virtualRow.index]
        return (
          <RowComponent
            key={row.id}
            layout={layout}
            row={row}
            virtualRow={virtualRow}
            visibleCells={row.getVisibleCells()}
            virtualColumns={virtualColumns}
            leafColumns={leafColumns}
            leftCellSlot={leftCellSlot}
            rightCellSlot={rightCellSlot}
            cellSlot={cellSlot}
            actionRowSlot={actionRowSlot}
            headerRowCount={headerRowCount}
            selectableRows={selectableRows}
            isVirtualColumns={isVirtualColumns}
          />
        )
      })}
    </div>
  )
}

// Мемоизация активна только во время ресайза колонок.
export const MemoizedBody = memo(
  Body,
  (_, next) => next.isResizingColumns !== false,
)
MemoizedBody.displayName = 'MemoizedBody'
