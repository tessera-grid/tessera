// Cutover (grid) — v9-порт DnD-обвязки тела. BodyDndBoundary монтирует DndContext
// + SortableContext только при enableRowDragging (иначе цена useSortable платится
// на каждый смонтированный ряд). Состояние overlay читается из атома rowDragging;
// геометрия переупорядочивания — getRowDraggingEvents.
import { type PropsWithChildren, useMemo } from 'react'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import type { Table } from '../types'
import { useSlice } from '../core/reactivity'
import { getRowDraggingEvents } from '../plugins/rowDragging'
import {
  Z_INDEX,
  adjustOverlayPosition,
  autoScrollOnlyY,
  dropAnimationConfig,
  measuring,
} from './dnd/parameters'
import { OverlayBodyRow } from './OverlayBodyRow'

export interface DndBodyWrapperProps {
  table: Table<any, any>
}

export interface BodyDndBoundaryProps extends DndBodyWrapperProps {
  enableRowDragging: boolean
}

/**
 * Монтирует Drag&Drop-обвязку тела только при включённом перетаскивании строк.
 */
export const BodyDndBoundary = ({
  table,
  enableRowDragging,
  children,
}: PropsWithChildren<BodyDndBoundaryProps>) => {
  if (!enableRowDragging) {
    return children
  }

  return <DndBodyWrapper table={table}>{children}</DndBodyWrapper>
}

export const DndBodyWrapper = ({
  table,
  children,
}: PropsWithChildren<DndBodyWrapperProps>) => {
  const {
    onRowDragStart,
    onRowDragMove,
    onRowDragEnd,
    onRowDragCancel,
    onRowDragAbort,
  } = getRowDraggingEvents(table)

  const rowDragging = useSlice(table, 'rowDragging' as never) as {
    activeId: string | null
  }

  const { rows } = table.getRowModel()

  const draggableRow = useMemo(
    () => rows.find((row: any) => row.id === rowDragging.activeId),
    [rowDragging.activeId, rows],
  )

  const draggableRowCell = useMemo(
    () =>
      draggableRow
        ?.getVisibleCells()
        .find((cell: any) => !cell.column.getIsActionsColumn()),
    [draggableRow],
  )

  const items = useMemo(() => rows.map((row: any) => row.id), [rows])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(MouseSensor),
    useSensor(TouchSensor),
  )

  return (
    <DndContext
      id="data-grid-dnd-rows"
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      autoScroll={autoScrollOnlyY}
      onDragStart={onRowDragStart}
      onDragMove={onRowDragMove}
      onDragEnd={onRowDragEnd}
      onDragCancel={onRowDragCancel}
      onDragAbort={onRowDragAbort}
    >
      <SortableContext
        id="data-grid-sortable-rows"
        items={items}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
      <DragOverlay
        modifiers={[adjustOverlayPosition]}
        dropAnimation={dropAnimationConfig}
        zIndex={Z_INDEX}
      >
        {draggableRowCell && (
          <OverlayBodyRow
            firstCell={draggableRowCell}
            withCount={draggableRow?.getCanExpand()}
            subRowsCount={draggableRow?.subRows.length}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
