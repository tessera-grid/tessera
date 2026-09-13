// Cutover (grid) — v9-порт DnD-обвязки хедера. HeadDndBoundary монтирует DndContext
// + SortableContext только при enableColumnDragging (иначе цена useSortable платится
// на каждую ячейку). Состояние overlay читается из атома columnDraggingActiveId.
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
import { Z_INDEX, autoScrollOnlyX } from './dnd/parameters'
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

  const columnDraggingActiveId = useSlice(table, 'columnDraggingActiveId' as never)

  const { onColumnDragStart, onColumnDragEnd } = table.options as unknown as {
    onColumnDragStart?: (event: unknown) => void
    onColumnDragEnd?: (event: unknown) => void
  }

  const draggableHeader = useMemo(() => {
    return headers.find((header: any) => header.id === columnDraggingActiveId)
  }, [columnDraggingActiveId, headers])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(MouseSensor),
    useSensor(TouchSensor),
  )

  const items: string[] = useMemo(
    () => headers.map((header: any) => header.column.id),
    [headers],
  )

  return (
    <DndContext
      id="data-grid-dnd-columns"
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
