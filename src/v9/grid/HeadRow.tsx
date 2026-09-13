// Cutover (grid) — v9-порт HeadRow: строка заголовка (заголовки группы → HeadCell).
// DraggableHeadCell (drag через useSortable) не портирован — на cutover в браузере,
// поэтому `enableColumnDragging` пока игнорируется (всегда HeadCell). Filler/Empty
// колонки переиспортируются из v8-слоя (v8-независимы).
import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import {
  LeftEmptyColumn,
  RightEmptyColumn,
} from '../../lib/grid/VirtualizePaddingColumns'
import { RightFillerHeadColumn } from '../../lib/grid/HeadRow/RightFillerHeadColumn'
import type { HeaderGroup } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { HeadCell } from './HeadCell'

import styles from '../../lib/grid/HeadRow/HeadRow.module.css'

interface TableHeadRowProps {
  layout: 'grid' | 'flex'
  lastGroup: boolean
  headerGroup: HeaderGroup<any, any>
  virtualColumns: VirtualItem[]
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
  isVirtualColumns: boolean
  // TODO(cutover): при true рисовать DraggableHeadCell (useSortable/DndContext).
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
}: TableHeadRowProps) => {
  const { headers } = headerGroup

  if (!isVirtualColumns) {
    return (
      <div style={{ display: 'contents' }}>
        {headers.map(header => (
          <HeadCell
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
          <HeadCell
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
