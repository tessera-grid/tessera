import { CSSProperties, memo } from 'react'

import { ColumnSizingInfoState, HeaderGroup } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import { HeaderSlot } from '../../core/createSlots'
import { HeadRow } from '../HeadRow'

import styles from './Head.module.css'

interface TableHeadProps {
  layout: 'grid' | 'flex'
  style?: CSSProperties

  headerGroups: HeaderGroup<any>[]
  virtualColumns: VirtualItem[]

  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot

  isResizingColumns: ColumnSizingInfoState['isResizingColumn']
  isVirtualColumns: boolean
}

/**
 * @description
 * Компонент заголовка таблицы. Содержит в себе системную обертку для работоспособности DnD колонок и реализует отрисовку строк заголовка таблицы.
 */
export const Head = ({
  layout,
  style,

  headerGroups,
  virtualColumns,

  leftHeaderSlot,
  rightHeaderSlot,

  isResizingColumns: _isResizingColumns,
  isVirtualColumns,
}: TableHeadProps) => {
  return (
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
        />
      ))}
    </div>
  )
}

/**
 * @description Мемоизированная обертка компонента заголовка таблицы. Мемоизация работает только во время ресайзинга колонок.
 */
export const MemoizedHead = memo(
  Head,
  (_, next) => next.isResizingColumns !== false,
)

MemoizedHead.displayName = 'MemoizedHead'
