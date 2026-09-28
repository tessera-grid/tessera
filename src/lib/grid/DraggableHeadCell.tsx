import { memo } from 'react'

import { useSortable } from '@dnd-kit/sortable'

import { HeadCellView, type TableHeadCellProps } from './HeadCell'
import { getDisabledSortable } from './headCellParams'

/**
 * Ячейка заголовка с включённым Drag&Drop: регистрирует колонку в SortableContext;
 * для закреплённых/служебных колонок сортировка отключается через `disabled`.
 */
export const DraggableHeadCell = memo((props: TableHeadCellProps) => {
  const { header } = props

  const disabledSortable = getDisabledSortable(header)

  const {
    setActivatorNodeRef,
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: header.column.id,
    data: {
      type: 'column',
      orderIndex: header.column.getIndex(),
      // При presence-based композиции columnDragging может отсутствовать — тогда
      // getDraggableIndex не определён, а сортировка всё равно заблокирована.
      draggableIndex: header.column.getDraggableIndex?.() ?? -1,
      disabledSortable,
    },
    disabled: disabledSortable,
  })

  return (
    <HeadCellView
      {...props}
      disabledSortable={disabledSortable}
      drag={{
        setNodeRef,
        setActivatorNodeRef,
        listeners,
        attributes,
        transformX: transform?.x ?? 0,
        isDragging,
      }}
    />
  )
})

DraggableHeadCell.displayName = 'DraggableHeadCell'
