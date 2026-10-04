// HeadRow: строка заголовка (заголовки группы → HeadCell/DraggableHeadCell). При
// enableColumnDragging рисуется DraggableHeadCell (useSortable под DndContext
// хедера), иначе обычная HeadCell.
import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { HeaderGroup } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { DraggableHeadCell } from './DraggableHeadCell'
import { HeadCell } from './HeadCell'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
import { RightFillerHeadColumn } from './RightFillerHeadColumn'
import { needsRightFiller } from './layout'

import styles from '../grid/HeadRow/HeadRow.module.css'

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
      <div
        role="row"
        aria-rowindex={headerGroup.depth + 1}
        style={{ display: 'contents' }}
      >
        {headers.map(header => (
          <CellComponent
            key={header.id}
            layout={layout}
            header={header}
            leftHeaderSlot={leftHeaderSlot}
            rightHeaderSlot={rightHeaderSlot}
          />
        ))}
        {needsRightFiller(headers.at(-1)?.getLeafHeaders().at(-1)?.column) && (
          <RightFillerHeadColumn
            gridRow={headerGroup.depth + 1}
            hasBorderBottom={!lastGroup}
            hasBorderRight
          />
        )}
      </div>
    )
  }

  // Пиннутые заголовки — sticky в потоке; центральные — position:absolute по своему
  // `left` (вне потока). Спейсер постоянной ширины держит поток. Симметрично телу.
  const startHeaders: typeof headers = []
  const endHeaders: typeof headers = []
  const centerHeaders: { header: (typeof headers)[number]; start: number }[] =
    []
  for (const virtualColumn of virtualColumns) {
    const header = headers[virtualColumn.index]
    const pinned = header.column.getIsPinned()
    if (pinned === 'start') startHeaders.push(header)
    else if (pinned === 'end') endHeaders.push(header)
    else centerHeaders.push({ header, start: virtualColumn.start })
  }

  const cell = (header: (typeof headers)[number], absoluteLeft?: number) => (
    <CellComponent
      key={header.id}
      layout={layout}
      header={header}
      leftHeaderSlot={leftHeaderSlot}
      rightHeaderSlot={rightHeaderSlot}
      absoluteLeft={absoluteLeft}
    />
  )

  return (
    <div
      className={clsx('data-grid__head-row', styles.HeadRow)}
      role="row"
      aria-rowindex={headerGroup.depth + 1}
    >
      {startHeaders.map(header => cell(header))}
      <VirtualCenterSpacer />
      {centerHeaders.map(({ header, start }) => cell(header, start))}
      {endHeaders.map(header => cell(header))}
    </div>
  )
}
