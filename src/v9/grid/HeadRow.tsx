// Cutover (grid) — v9-порт HeadRow: строка заголовка (заголовки группы → HeadCell/
// DraggableHeadCell). При enableColumnDragging рисуется DraggableHeadCell
// (useSortable под DndContext хедера), иначе обычная HeadCell.
import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { HeaderGroup } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { DraggableHeadCell, HeadCell } from './HeadCell'
import { LeftEmptyColumn, RightEmptyColumn } from './VirtualizePaddingColumns'
import { RightFillerHeadColumn } from './RightFillerHeadColumn'

import styles from '../../lib/grid/HeadRow/HeadRow.module.css'

interface TableHeadRowProps {
  layout: 'grid' | 'flex'
  lastGroup: boolean
  headerGroup: HeaderGroup<any, any>
  virtualColumns: VirtualItem[]
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
  isVirtualColumns: boolean
  enableColumnDragging?: boolean
}

export const HeadRow = ({
  layout,
  lastGroup,
  headerGroup,
  virtualColumns,
  leftHeaderSlot,
  rightHeaderSlot,
  isVirtualColumns,
  enableColumnDragging,
}: TableHeadRowProps) => {
  const { headers } = headerGroup

  const CellComponent = enableColumnDragging ? DraggableHeadCell : HeadCell

  if (!isVirtualColumns) {
    return (
      <div style={{ display: 'contents' }}>
        {headers.map(header => (
          <CellComponent
            key={header.id}
            layout={layout}
            header={header}
            leftHeaderSlot={leftHeaderSlot}
            rightHeaderSlot={rightHeaderSlot}
          />
        ))}
        {!headers.at(-1)?.column.getIsActionsColumn() && (
          <RightFillerHeadColumn
            gridRow={headerGroup.depth + 1}
            hasBorderBottom={!lastGroup}
            hasBorderRight
          />
        )}
      </div>
    )
  }

  return (
    <div
      className={clsx('data-grid__head-row', styles.HeadRow)}
      role="row"
      aria-rowindex={headerGroup.depth + 1}
    >
      <LeftEmptyColumn />
      {virtualColumns.map(virtualColumn => {
        const header = headers[virtualColumn.index]
        return (
          <CellComponent
            key={header.id}
            layout={layout}
            header={header}
            leftHeaderSlot={leftHeaderSlot}
            rightHeaderSlot={rightHeaderSlot}
          />
        )
      })}
      <RightEmptyColumn />
    </div>
  )
}
