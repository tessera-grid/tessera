import { memo } from 'react'

import { Column, Row } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import { CellSlot } from '../../core/createSlots'
import { BodyRow } from '../BodyRow'

import styles from './Body.module.css'

interface TableBodyProps {
  layout: 'grid' | 'flex'

  rows: Row<any>[]
  virtualRows: VirtualItem[]

  virtualColumns: VirtualItem[]
  leafColumns: Column<any, unknown>[]

  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  actionRowSlot?: CellSlot

  isResizingColumns: false | string
  isVirtualColumns: boolean
}

/**
 * @description
 * Компонент тела таблицы. Реализует отрисовку строк тела таблицы.
 */
export const Body = ({
  layout,

  rows,
  virtualRows,

  virtualColumns,
  leafColumns,

  leftCellSlot,
  rightCellSlot,
  actionRowSlot,

  isResizingColumns: _isResizingColumns,
  isVirtualColumns,
}: TableBodyProps) => {
  return (
    <div
      className={clsx('data-grid__body', styles.body)}
      role="rowgroup"
      data-layout={layout}
    >
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
            isVirtualColumns={isVirtualColumns}
          />
        )
      })}
    </div>
  )
}

/**
 * @description Мемоизированная обертка компонента тела таблицы. Мемоизация работает только во время ресайзинга колонок.
 */
export const MemoizedBody = memo(
  Body,
  (_, next) => next.isResizingColumns !== false,
)

MemoizedBody.displayName = 'MemoizedBody'
