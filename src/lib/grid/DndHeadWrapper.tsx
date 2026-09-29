// DnD-обвязка хедера. HeadDndBoundary монтирует DndContext + SortableContext только
// при enableColumnDragging (иначе цена useSortable платится на каждую ячейку).
// Состояние overlay читается из атома columnDraggingActiveId.
import { type PropsWithChildren, useMemo } from 'react'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'

import type { Table } from '../types'
import type { HeaderSlot } from '../core/createSlots'
import { useSlice } from '../core/reactivity'
import { getColumnDraggingEvents } from '../plugins/columnDragging'
import {
  Z_INDEX,
  autoScrollOnlyX,
  dndAccessibility,
  sensorOptions,
} from './dnd/parameters'
import { horizontalCollisionDetection } from './dnd/collisionDetection'
import { OverlayHeadCell } from './OverlayHeadCell'

export interface DndHeadWrapperProps {
  table: Table<any, any>
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
}

export interface HeadDndBoundaryProps extends DndHeadWrapperProps {
  enableColumnDragging: boolean
}

/**
 * Монтирует Drag&Drop-обвязку хедера только при включённом перетаскивании колонок.
 */
export const HeadDndBoundary = ({
  table,
  leftHeaderSlot,
  rightHeaderSlot,
  enableColumnDragging,
  children,
}: PropsWithChildren<HeadDndBoundaryProps>) => {
  if (!enableColumnDragging) {
    return children
  }

  return (
    <DndHeadWrapper
      table={table}
      leftHeaderSlot={leftHeaderSlot}
      rightHeaderSlot={rightHeaderSlot}
    >
      {children}
    </DndHeadWrapper>
  )
}

export const DndHeadWrapper = ({
  table,
  leftHeaderSlot,
  rightHeaderSlot,
  children,
}: PropsWithChildren<DndHeadWrapperProps>) => {
  const headers = table.getFlatHeaders()

  const columnDraggingActiveId = useSlice(
    table,
    'columnDraggingActiveId' as never,
  )

  // Редьюсер dnd-событий столбцов (меняет стейт методами таблицы — фасад useTable
  // несёт сырые options без фичевых on*Change).
  const { onColumnDragStart, onColumnDragEnd } = getColumnDraggingEvents(
    table as never,
  )

  const draggableHeader = useMemo(() => {
    return headers.find((header: any) => header.id === columnDraggingActiveId)
  }, [columnDraggingActiveId, headers])

  const sensors = useSensors(
    useSensor(PointerSensor, sensorOptions),
    useSensor(MouseSensor, sensorOptions),
    useSensor(TouchSensor, sensorOptions),
  )

  const items: string[] = useMemo(
    () => headers.map((header: any) => header.column.id),
    [headers],
  )

  return (
    <DndContext
      id="data-grid-dnd-columns"
      accessibility={dndAccessibility}
      collisionDetection={horizontalCollisionDetection}
      sensors={sensors}
      modifiers={[restrictToHorizontalAxis]}
      autoScroll={autoScrollOnlyX}
      onDragEnd={onColumnDragEnd}
      onDragStart={onColumnDragStart}
    >
      <SortableContext items={items} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay zIndex={Z_INDEX}>
        {draggableHeader && (
          <OverlayHeadCell
            header={draggableHeader}
            leftHeaderSlot={leftHeaderSlot}
            rightHeaderSlot={rightHeaderSlot}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
