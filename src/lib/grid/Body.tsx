// Body: контейнер тела. Виртуализация приходит пропсами (virtualRows/virtualColumns
// считает DataGrid), Body лишь маппит строки в BodyRow/DraggableBodyRow. При
// enableRowDragging рисуется DraggableBodyRow (useSortable под DndContext тела),
// иначе обычная BodyRow.
import { memo, useMemo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { Column, Row } from '../types'
import type { CellSlot } from '../core/createSlots'
import { BodyRow, DraggableBodyRow, type TreeAria } from './BodyRow'

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
  /** Строки несут aria-level/setsize/posinset (treegrid). */
  treeRows?: boolean
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
  treeRows,
  isVirtualColumns,
  enableRowDragging,
}: TableBodyProps) => {
  const RowComponent = enableRowDragging ? DraggableBodyRow : BodyRow
  const treeAria = useMemo(
    () => (treeRows ? getTreeAria(rows) : undefined),
    [treeRows, rows],
  )

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
            treeAria={treeAria?.get(row.id)}
            isVirtualColumns={isVirtualColumns}
          />
        )
      })}
    </div>
  )
}

/** Уровень и позиция строки среди соседей того же родителя в видимой модели. */
const getTreeAria = (rows: Row<any, any>[]) => {
  const siblings = new Map<string, Row<any, any>[]>()
  for (const row of rows) {
    const key = row.parentId ?? ''
    const group = siblings.get(key)
    if (group) {
      group.push(row)
    } else {
      siblings.set(key, [row])
    }
  }
  const aria = new Map<string, TreeAria>()
  for (const group of siblings.values()) {
    group.forEach((row, index) =>
      aria.set(row.id, {
        'aria-level': row.depth + 1,
        'aria-setsize': group.length,
        'aria-posinset': index + 1,
      }),
    )
  }
  return aria
}

// Мемоизация активна только во время ресайза колонок.
export const MemoizedBody = memo(
  Body,
  (_, next) => next.isResizingColumns !== false,
)
MemoizedBody.displayName = 'MemoizedBody'
