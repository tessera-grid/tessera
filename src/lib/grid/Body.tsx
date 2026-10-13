// Body: контейнер тела. Виртуализация приходит пропсами (virtualRows/virtualColumns
// считает DataGrid), Body лишь маппит строки в BodyRow/DraggableBodyRow. При
// enableRowDragging рисуется DraggableBodyRow (useSortable под DndContext тела),
// иначе обычная BodyRow.
import { memo, useMemo, useRef } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { Column, Row } from '../types'
import type { CellSlot } from '../core/createSlots'
import { BodyRow } from './BodyRow'
import { DraggableBodyRow } from './DraggableBodyRow'
import { RowMotion } from './rowMotion/RowMotion'
import { getTreeAria } from './treeAria'
import { getTreeLines } from './treeBranches'

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
  /** `aria-rowindex` первой строки тела минус 1: строки шапки + строки прошлых страниц. */
  ariaRowIndexBase: number
  selectableRows?: boolean
  /** Строки несут aria-level/setsize/posinset (treegrid). */
  treeRows?: boolean
  /** Ветки линий дерева (ADR 0102). */
  treeLines?: boolean
  isResizingColumns: false | string
  isVirtualColumns: boolean
  enableRowDragging?: boolean
  /** Движение строк при смене модели (ADR 0107). */
  rowAnimation?: boolean
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
  ariaRowIndexBase,
  selectableRows,
  treeRows,
  treeLines,
  isVirtualColumns,
  enableRowDragging,
  rowAnimation = false,
}: TableBodyProps) => {
  const bodyRef = useRef<HTMLDivElement>(null)
  const RowComponent = enableRowDragging ? DraggableBodyRow : BodyRow
  const treeAria = useMemo(
    () => (treeRows ? getTreeAria(rows) : undefined),
    [treeRows, rows],
  )
  const treeLinesIndex = useMemo(
    () => (treeLines ? getTreeLines(rows) : undefined),
    [treeLines, rows],
  )

  return (
    <div
      ref={bodyRef}
      className={clsx('data-grid__body', styles.body)}
      role="rowgroup"
      data-layout={layout}
    >
      <RowMotion
        enabled={rowAnimation}
        rows={rows}
        virtualRows={virtualRows}
        bodyRef={bodyRef}
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
              ariaRowIndexBase={ariaRowIndexBase}
              selectableRows={selectableRows}
              treeSetSize={treeAria?.setSize(virtualRow.index)}
              treePosInSet={treeAria?.posInSet(virtualRow.index)}
              treeBranch={treeLinesIndex?.branch(virtualRow.index)}
              treeOpen={treeLinesIndex?.open(virtualRow.index)}
              isVirtualColumns={isVirtualColumns}
            />
          )
        })}
      </RowMotion>
    </div>
  )
}

// Мемоизация активна только во время ресайза колонок.
export const MemoizedBody = memo(
  Body,
  (_, next) => next.isResizingColumns !== false,
)
MemoizedBody.displayName = 'MemoizedBody'
