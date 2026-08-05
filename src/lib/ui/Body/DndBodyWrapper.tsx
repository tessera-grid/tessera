import { PropsWithChildren, useMemo } from 'react'

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
import { Table } from '@tanstack/react-table'

import {
  Z_INDEX,
  adjustOverlayPosition,
  autoScrollOnlyY,
  dropAnimationConfig,
  measuring,
} from '../../core/dnd/parameters'
import { getRowDraggingEvents } from '../../plugins/rowDragging/getRowDraggingEvents'
import { OverlayBodyRow } from '../BodyRow/OverlayBodyRow'

export interface DndBodyWrapperProps {
  table: Table
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

  const { rowDragging } = table.getState()

  const { rows } = table.getRowModel()

  const draggableRow = useMemo(
    () => rows.find(row => row.id === rowDragging.activeId),
    [rowDragging.activeId, rows],
  )

  const draggableRowCell = useMemo(
    () =>
      draggableRow
        ?.getVisibleCells()
        .find(cell => !cell.column.getIsActionsColumn()),
    [draggableRow],
  )

  const items = useMemo(() => rows.map(row => row.id), [rows])

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
