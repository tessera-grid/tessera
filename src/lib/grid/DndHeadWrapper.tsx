// DnD-обвязка хедера. HeadDndBoundary монтирует DndContext + SortableContext только
// при enableColumnDragging (иначе цена useSortable платится на каждую ячейку).
// Состояние overlay читается из атома columnDraggingActiveId.
import { type PropsWithChildren, useMemo, useState } from 'react'

import {
  type CollisionDetection,
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
import { cancelDragLikeEscape } from '../core/cancelInteraction'
import { useSlice, useTableState } from '../core/reactivity'
import { getColumnDraggingEvents } from '../plugins/columnDragging'
import {
  Z_INDEX,
  autoScrollOnlyX,
  dndAccessibility,
  sensorOptions,
} from './dnd/parameters'
import { horizontalCollisionDetection } from './dnd/collisionDetection'
import { OverlayHeadCell } from './OverlayHeadCell'
import { NodeShiftContext, createNodeShiftStore } from './dnd/nodeShift'
import { nodeIdOf, zoneOf } from '../core/columnNodes'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'

/** Столкновения — только с соседями активного узла (ADR 0052, ND3). */
const siblingCollisionDetection: CollisionDetection = args => {
  const key = args.active.data.current?.siblingKey
  return horizontalCollisionDetection({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      container => container.data.current?.siblingKey === key,
    ),
  })
}

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
  // Идущее перетаскивание держит обёртку, пока его не отменят (ADR 0039, RX14).
  const activeId = useTableState(
    table,
    state =>
      (state as { columnDraggingActiveId?: string | null })
        .columnDraggingActiveId ?? null,
  )
  if (!enableColumnDragging && !activeId) {
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
  const { onColumnDragStart, onColumnDragEnd, onColumnDragCancel } =
    getColumnDraggingEvents(table as never)

  const draggableHeader = useMemo(() => {
    return headers.find((header: any) => header.id === columnDraggingActiveId)
  }, [columnDraggingActiveId, headers])

  // Перетаскивание запретили на лету или колонка ушла — отмена как по Escape.
  const forbidden =
    !!columnDraggingActiveId &&
    (!(table.options as { enableColumnDragging?: boolean })
      .enableColumnDragging ||
      !(
        draggableHeader?.column as { getCanDrag?: () => boolean } | undefined
      )?.getCanDrag?.())
  const lost = !draggableHeader
  useIsomorphicLayoutEffect(() => {
    if (forbidden) {
      cancelDragLikeEscape(lost ? 'unavailable' : 'revoke')
    }
  }, [forbidden, lost])

  const sensors = useSensors(
    useSensor(PointerSensor, sensorOptions),
    useSensor(MouseSensor, sensorOptions),
    useSensor(TouchSensor, sensorOptions),
  )

  // Плоская шапка — одна группа соседей; во вложенной SortableContext у каждой серии
  // соседей свой (HeadRow), этот остаётся внешним.
  const items: string[] = useMemo(
    () => headers.map((header: any) => header.id),
    [headers],
  )

  const [shiftStore] = useState(createNodeShiftStore)
  const activeNodeId = draggableHeader
    ? nodeIdOf(draggableHeader.column, zoneOf(draggableHeader as never))
    : null
  useIsomorphicLayoutEffect(() => {
    shiftStore.setActive(activeNodeId)
  }, [shiftStore, activeNodeId])

  return (
    <DndContext
      id="data-grid-dnd-columns"
      accessibility={dndAccessibility}
      collisionDetection={siblingCollisionDetection}
      sensors={sensors}
      modifiers={[restrictToHorizontalAxis]}
      autoScroll={autoScrollOnlyX}
      onDragEnd={onColumnDragEnd}
      onDragStart={onColumnDragStart}
      onDragCancel={onColumnDragCancel}
    >
      <NodeShiftContext.Provider value={shiftStore}>
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          {children}
        </SortableContext>
      </NodeShiftContext.Provider>
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
