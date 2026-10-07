// Head: контейнер заголовка (headerGroups → HeadRow). Виртуализация приходит
// пропсом. DnD-обвязка (enableColumnDragging→DraggableHeadCell) внутри HeadRow.
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
  /** Шапка внутри скелета первой загрузки: скрыта от скринридера и неинтерактивна. */
  skeleton?: boolean
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
  skeleton,
}: TableHeadProps) => (
  <div
    className={clsx('data-grid__head', styles.head, {
      'data-grid__head--skeleton': skeleton,
    })}
    style={style}
    role="rowgroup"
    data-layout={layout}
    aria-hidden={skeleton || undefined}
    inert={skeleton}
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

// Мемоизация активна только во время ресайза колонок.
export const MemoizedHead = memo(
  Head,
  (_, next) => next.isResizingColumns !== false,
)
MemoizedHead.displayName = 'MemoizedHead'
