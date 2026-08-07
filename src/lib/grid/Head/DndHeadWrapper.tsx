import { PropsWithChildren, useMemo } from 'react'

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
import { Table } from '@tanstack/react-table'

import { HeaderSlot } from '../../core/createSlots'
import { Z_INDEX, autoScrollOnlyX } from '../../core/dnd/parameters'
import { OverlayHeadCell } from '../HeadCell/OverlayHeadCell'
import { horizontalCollisionDetection } from './collisionDetection'

export interface DndHeadWrapperProps {
  table: Table
  leftHeaderSlot?: HeaderSlot
  rightHeaderSlot?: HeaderSlot
}

export interface HeadDndBoundaryProps extends DndHeadWrapperProps {
  enableColumnDragging: boolean
}

/**
 * @description
 * Монтирует Drag&Drop-обвязку хедера (`DndContext` + `SortableContext`) только
 * когда перетаскивание колонок включено. При выключенном `enableColumnDragging`
 * хедер рендерится напрямую — без sortable-контекста, цена которого иначе
 * платилась бы на каждую отрендеренную при горизонтальном скролле ячейку.
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

/**
 * @description
 * Компонент-обертка для реализации Drag&Drop для колонок таблицы только для компонентов хедера.
 */
export const DndHeadWrapper = ({
  table,
  leftHeaderSlot,
  rightHeaderSlot,
  children,
}: PropsWithChildren<DndHeadWrapperProps>) => {
  const headers = table.getFlatHeaders()

  const { columnDraggingActiveId } = table.getState()

  const { onColumnDragStart, onColumnDragEnd } = table.options

  const draggableHeader = useMemo(() => {
    return headers.find(header => header.id === columnDraggingActiveId)
  }, [columnDraggingActiveId, headers])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(MouseSensor),
    useSensor(TouchSensor),
  )

  const items: string[] = useMemo(
    () => headers.map(header => header.column.id),
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
