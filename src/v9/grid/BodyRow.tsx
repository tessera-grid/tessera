// Cutover (grid) — v9-порт BodyRow (без drag: DraggableBodyRow/useSortable требует
// SortableContext и портируется на cutover). Ряд ячеек (виртуализация приходит
// пропсами virtualRow/virtualColumns). Реактивность через useTableState (в v8 —
// useSubscribeStore). Row-методы фич (getIsSelected/getIsExpanded/getIsGrouped)
// вызываются через ?. — плагина может не быть в наборе.
import { memo, useMemo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import {
  LeftEmptyColumn,
  RightEmptyColumn,
} from '../../lib/grid/VirtualizePaddingColumns'
import { RightFillerBodyColumn } from '../../lib/grid/BodyRow/RightFillerBodyColumn'
import type { Cell, Column, Row } from '../types'
import type { CellSlot } from '../core/createSlots'
import { useTableState } from '../core/reactivity'
import { BodyCell } from './BodyCell'

import styles from '../../lib/grid/BodyRow/BodyRow.module.css'

interface TableBodyRowProps {
  layout: 'grid' | 'flex'
  row: Row<any, any>
  visibleCells: Cell<any, any, unknown>[]
  virtualRow: VirtualItem
  virtualColumns: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  actionRowSlot?: CellSlot
  headerRowCount: number
  isVirtualColumns: boolean
}

const BodyRowCells = ({
  layout,
  row,
  virtualRow,
  visibleCells,
  virtualColumns,
  leafColumns,
  leftCellSlot,
  rightCellSlot,
  actionRowSlot,
  isVirtualColumns,
}: TableBodyRowProps) => {
  if (isVirtualColumns) {
    return (
      <>
        <LeftEmptyColumn />
        {virtualColumns.map(virtualColumn => {
          const cell = visibleCells[virtualColumn.index]
          return (
            <BodyCell
              key={cell.id}
              layout={layout}
              cell={cell}
              rowIndex={virtualRow?.index}
              leftCellSlot={leftCellSlot}
              rightCellSlot={rightCellSlot}
              actionRowSlot={actionRowSlot}
            />
          )
        })}
        <RightEmptyColumn />
      </>
    )
  }

  return (
    <>
      {leafColumns.map(column => {
        const cell = visibleCells[column.getIndex()]
        return (
          <BodyCell
            key={cell.id}
            layout={layout}
            cell={cell}
            rowIndex={virtualRow?.index}
            leftCellSlot={leftCellSlot}
            rightCellSlot={rightCellSlot}
            actionRowSlot={actionRowSlot}
          />
        )
      })}
      {!row.getVisibleCells().at(-1)?.column.getIsActionsColumn() && (
        <RightFillerBodyColumn hasBorderTop={!row.getIsFirstRow()} hasBorderRight />
      )}
    </>
  )
}

export const BodyRow = memo((props: TableBodyRowProps) => {
  const { layout, row, virtualRow, headerRowCount } = props

  // Коарс-подписка (TODO Phase D: сузить до rowSelection/expanded).
  useTableState((row as unknown as { table: never }).table, (state: unknown) => state)

  const canExpand = row.getCanExpand?.() ?? false
  const isExpanded = row.getIsExpanded?.() ?? false

  const rowStyles = useMemo(() => ({ top: virtualRow.start }), [virtualRow.start])

  return (
    <div
      className={clsx('data-grid__body-row', styles.body__row)}
      role="row"
      aria-rowindex={headerRowCount + virtualRow.index + 1}
      aria-expanded={canExpand ? isExpanded : undefined}
      data-index={virtualRow.index}
      data-selected={row.getIsSelected?.() ?? false}
      data-expanded={canExpand ? isExpanded : undefined}
      data-group-row={row.getIsGrouped?.() ?? false}
      data-row-odd={virtualRow.index % 2 !== 0}
      data-row-interact
      data-last-row={row.getIsLastRow()}
      data-layout={layout}
      style={rowStyles}
    >
      <BodyRowCells {...props} />
    </div>
  )
})

BodyRow.displayName = 'BodyRow'
