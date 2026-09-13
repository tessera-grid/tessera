// Cutover (grid) — v9-порт Body: контейнер тела. Виртуализация приходит пропсами
// (virtualRows/virtualColumns считает DataGrid), Body лишь маппит строки в BodyRow.
// DraggableBodyRow (drag) — на cutover; enableRowDragging пока игнорируется.
import { memo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { Column, Row } from '../types'
import type { CellSlot } from '../core/createSlots'
import { BodyRow } from './BodyRow'

import styles from '../../lib/grid/Body/Body.module.css'

interface TableBodyProps {
  layout: 'grid' | 'flex'
  rows: Row<any, any>[]
  virtualRows: VirtualItem[]
  virtualColumns: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  actionRowSlot?: CellSlot
  headerRowCount: number
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
  actionRowSlot,
  headerRowCount,
  isVirtualColumns,
}: TableBodyProps) => (
  <div className={clsx('data-grid__body', styles.body)} role="rowgroup" data-layout={layout}>
    {virtualRows.map(virtualRow => {
      const row = rows[virtualRow.index]
      return (
        <BodyRow
          key={row.id}
          layout={layout}
          row={row}
          virtualRow={virtualRow}
          visibleCells={row.getVisibleCells()}
          virtualColumns={virtualColumns}
          leafColumns={leafColumns}
          leftCellSlot={leftCellSlot}
          rightCellSlot={rightCellSlot}
          actionRowSlot={actionRowSlot}
          headerRowCount={headerRowCount}
          isVirtualColumns={isVirtualColumns}
        />
      )
    })}
  </div>
)

// Мемоизация активна только во время ресайза колонок (как в v8).
export const MemoizedBody = memo(Body, (_, next) => next.isResizingColumns !== false)
MemoizedBody.displayName = 'MemoizedBody'
