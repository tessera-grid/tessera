// Обёртка шапки плагина columnDragging (ADR 0168, §2): DndContext + SortableContext
// колонок — только при включённом перетаскивании или идущей сессии. Состояние облака —
// срез columnDraggingActiveId, облако рисует грид.
import { useMemo, useState } from 'react'

import {
  type CollisionDetection,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'

import { cancelDragLikeEscape } from '../../core/cancelInteraction'
import type { HeadBoundaryProps } from '../../core/pluginWrappers'
import { useSlice, useTableState } from '../../core/reactivity'
import { getColumnDraggingEvents } from './getColumnDraggingEvents'
import {
  NonTouchPointerSensor,
  Z_INDEX,
  autoScrollOnlyX,
  dndAccessibility,
  sensorOptions,
  touchSensorOptions,
} from '../../shared/dnd/parameters'
import { horizontalCollisionDetection } from './collisionDetection'
import { NodeShiftContext, createNodeShiftStore } from './nodeShift'
import { nodeIdOf, zoneOf } from '../../core/columnNodes'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'

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

/** Монтирует Drag&Drop-обвязку шапки только при включённом перетаскивании колонок. */
export const HeadBoundary = ({
  table,
  renderCloud,
  children,
}: HeadBoundaryProps) => {
  // Идущее перетаскивание держит обёртку, пока его не отменят (ADR 0039, RX14).
  const activeId = useTableState(
    table,
    state =>
      (state as { columnDraggingActiveId?: string | null })
        .columnDraggingActiveId ?? null,
  )
  if (!table.options.enableColumnDragging && !activeId) {
    return children
  }

  return (
    <DndHeadWrapper table={table} renderCloud={renderCloud}>
      {children}
    </DndHeadWrapper>
  )
}

const DndHeadWrapper = ({
  table,
  renderCloud,
  children,
}: HeadBoundaryProps) => {
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
    (!table.options.enableColumnDragging ||
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
    useSensor(NonTouchPointerSensor, sensorOptions),
    useSensor(MouseSensor, sensorOptions),
    useSensor(TouchSensor, touchSensorOptions),
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
        {draggableHeader && renderCloud(draggableHeader)}
      </DragOverlay>
    </DndContext>
  )
}
