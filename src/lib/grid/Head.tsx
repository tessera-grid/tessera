// Cutover (grid) — v9-порт Head: контейнер заголовка (headerGroups → HeadRow).
// Виртуализация приходит пропсом. DnD-обвязка (enableColumnDragging→DraggableHeadCell)
// внутри HeadRow — на cutover.
import { type CSSProperties, memo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { HeaderGroup } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { HeadRow } from './HeadRow'

import styles from '../grid/Head/Head.module.css'

interface TableHeadProps {
  layout: 'grid' | 'flex'
  style?: CSSProperties
  headerGroups: HeaderGroup<any, any>[]
  virtualColumns: VirtualItem[]
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
  isResizingColumns: false | string | undefined
  isVirtualColumns: boolean
  enableColumnDragging?: boolean
}

export const Head = ({
  layout,
  style,
  headerGroups,
  virtualColumns,
  leftHeaderSlot,
  rightHeaderSlot,
  isVirtualColumns,
  enableColumnDragging,
}: TableHeadProps) => (
  <div
    className={clsx('data-grid__head', styles.head)}
    style={style}
    role="rowgroup"
    data-layout={layout}
  >
    {headerGroups.map(headerGroup => (
      <HeadRow
        key={headerGroup.id}
        layout={layout}
        headerGroup={headerGroup}
        lastGroup={headerGroups.at(-1)?.id === headerGroup.id}
        virtualColumns={virtualColumns}
        leftHeaderSlot={leftHeaderSlot}
        rightHeaderSlot={rightHeaderSlot}
        isVirtualColumns={isVirtualColumns}
        enableColumnDragging={enableColumnDragging}
      />
    ))}
  </div>
)

// Мемоизация активна только во время ресайза колонок (как в v8).
export const MemoizedHead = memo(Head, (_, next) => next.isResizingColumns !== false)
MemoizedHead.displayName = 'MemoizedHead'
