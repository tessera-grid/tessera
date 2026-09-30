// DnD-обвязка тела. BodyDndBoundary монтирует DndContext + SortableContext только
// при enableRowDragging (иначе цена useSortable платится на каждый смонтированный
// ряд). Состояние overlay читается из атома rowDragging; геометрия
// переупорядочивания — getRowDraggingEvents.
import { type PropsWithChildren, useMemo, useLayoutEffect } from 'react'

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
import { cancelDragLikeEscape } from '../core/cancelInteraction'
import { useSlice, useTableState } from '../core/reactivity'
import { getRowDraggingEvents } from '../plugins/rowDragging'
import {
  Z_INDEX,
  adjustOverlayPosition,
  autoScrollOnlyY,
  dndAccessibility,
  dropAnimationConfig,
  measuring,
  sensorOptions,
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
  // Идущее перетаскивание держит обёртку, пока его не отменят (ADR 0039, RX14).
  const activeId = useTableState(
    table,
    state =>
      (state as { rowDragging?: { activeId: string | null } }).rowDragging
        ?.activeId ?? null,
  )
  if (!enableRowDragging && !activeId) {
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

  // Перетаскивание запретили на лету или строка ушла — отмена как по Escape.
  const forbidden =
    !!rowDragging.activeId &&
    (!(table.options as { enableRowDragging?: unknown }).enableRowDragging ||
      !(
        draggableRow as { getCanDrag?: () => boolean } | undefined
      )?.getCanDrag?.())
  const lost = !draggableRow
  useLayoutEffect(() => {
    if (forbidden) {
      cancelDragLikeEscape(lost ? 'unavailable' : 'revoke')
    }
  }, [forbidden, lost])

  const draggableRowCell = useMemo(
    () =>
      draggableRow
        ?.getVisibleCells()
        .find((cell: any) => !cell.column.getIsActionsColumn()),
    [draggableRow],
  )

  const items = useMemo(() => rows.map((row: any) => row.id), [rows])

  const sensors = useSensors(
    useSensor(PointerSensor, sensorOptions),
    useSensor(MouseSensor, sensorOptions),
    useSensor(TouchSensor, sensorOptions),
  )

  return (
    <DndContext
      id="data-grid-dnd-rows"
      accessibility={dndAccessibility}
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
            withCount={draggableRow?.getCanExpand?.() ?? false}
            subRowsCount={draggableRow?.subRows.length}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
