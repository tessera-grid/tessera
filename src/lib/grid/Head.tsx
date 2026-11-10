// Head: контейнер заголовка (headerGroups → HeadRow). Виртуализация приходит
// пропсом. Перетаскивание колонок приносит декоратор плагина в HeadRow (ADR 0168).
import { type CSSProperties, memo } from 'react'

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import clsx from 'clsx'

import type { HeaderGroup } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { HeadRow } from './HeadRow'
import { HeaderMetricsProvider } from './headerActions/headerCapacity'

import styles from '../grid/Head/Head.module.css'
import { inertProp } from '../core/inertProp'

interface TableHeadProps {
  style?: CSSProperties
  headerGroups: HeaderGroup<any, any>[]
  virtualColumns: VirtualItem[]
  columnStarts?: number[]
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
  isResizingColumns: false | string | undefined
  /** Шапка внутри скелета первой загрузки: скрыта от скринридера и неинтерактивна. */
  skeleton?: boolean
}

export const Head = ({
  style,
  headerGroups,
  virtualColumns,
  columnStarts = [],
  leftHeaderSlot,
  rightHeaderSlot,
  skeleton,
}: TableHeadProps) => (
  <div
    className={clsx('data-grid__head', styles.head, {
      'data-grid__head--skeleton': skeleton,
    })}
    style={style}
    role="rowgroup"
    aria-hidden={skeleton || undefined}
    {...inertProp(!!skeleton)}
  >
    <HeaderMetricsProvider>
      {headerGroups.map(headerGroup => (
        <HeadRow
          key={headerGroup.id}
          headerGroup={headerGroup}
          lastGroup={headerGroups.at(-1)?.id === headerGroup.id}
          virtualColumns={virtualColumns}
          columnStarts={columnStarts}
          leftHeaderSlot={leftHeaderSlot}
          rightHeaderSlot={rightHeaderSlot}
        />
      ))}
    </HeaderMetricsProvider>
  </div>
)

// Мемоизация активна только во время ресайза колонок.
export const MemoizedHead = memo(
  Head,
  (_, next) => next.isResizingColumns !== false,
)
MemoizedHead.displayName = 'MemoizedHead'
