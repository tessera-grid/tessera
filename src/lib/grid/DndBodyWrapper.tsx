// DnD-обвязка тела. BodyDndBoundary монтирует DndContext + SortableContext только
// при enableRowDragging (иначе цена useSortable платится на каждый смонтированный
// ряд). Состояние overlay читается из атома rowDragging; геометрия
// переупорядочивания — getRowDraggingEvents.
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  DndContext,
  type DragStartEvent,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'

import type { Table } from '../types'
import { cancelDragLikeEscape } from '../core/cancelInteraction'
import { useSlice, useTableState } from '../core/reactivity'
import {
  type RowDragOverlayState,
  getRowDraggingEvents,
} from '../plugins/rowDragging'
import { createExpandTimer } from '../plugins/rowDragging/expandTimer'
import { readRowNestingIndent } from '../core/rowNesting'
import { createDropLevel } from './dnd/dropLevel'
import {
  Z_INDEX,
  adjustOverlayPosition,
  autoScrollOnlyY,
  dndAccessibility,
  measuring,
  sensorOptions,
} from './dnd/parameters'
import { OverlayBodyRow } from './OverlayBodyRow'
import { windowedListSortingStrategy } from './dnd/windowedListSortingStrategy'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'

/** Перетаскиваемая строка модели; без перетаскивания строки не обходятся (D33). */
export const findDraggableRow = <TRow extends { id: string }>(
  rows: readonly TRow[],
  activeId: string | null | undefined,
): TRow | undefined =>
  activeId == null ? undefined : rows.find(row => row.id === activeId)

/**
 * id строк для `SortableContext` тела — только строки окна виртуализатора (D34):
 * индексы и смещения dnd-kit нужны смонтированным строкам, перестановка считается
 * по `virtualIndex` из данных строки.
 */
export const getSortableRowIds = (
  rows: readonly { id: string }[],
  virtualRows: readonly { index: number }[],
): string[] => virtualRows.map(virtualRow => rows[virtualRow.index].id)

export interface DndBodyWrapperProps {
  table: Table<any, any>
  /** Окно виртуализатора строк: id для `SortableContext`. */
  virtualRows: readonly { index: number }[]
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
  virtualRows,
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

  return (
    <DndBodyWrapper table={table} virtualRows={virtualRows}>
      {children}
    </DndBodyWrapper>
  )
}

export const DndBodyWrapper = ({
  table,
  virtualRows,
  children,
}: PropsWithChildren<DndBodyWrapperProps>) => {
  // Уровень броска — по тексту облака (ADR 0108, §2): начало уровней строки меряется на
  // старте, отступ текста облака — по нему самому.
  const [dropLevel] = useState(createDropLevel)
  const attachOverlay = useCallback(
    (node: HTMLDivElement | null) => dropLevel.setOverlay(node),
    [dropLevel],
  )
  // Пауза над свёрнутой группой переживает перерисовки сессии (ADR 0109, §1).
  const [expandTimer] = useState(createExpandTimer)
  useEffect(() => expandTimer.clear, [expandTimer])
  const {
    onRowDragStart,
    onRowDragMove,
    onRowDragEnd,
    onRowDragCancel,
    onRowDragAbort,
  } = getRowDraggingEvents(table, {
    levelAt: dropLevel.levelAt,
    expandTimer,
  })
  const startDrag = (event: DragStartEvent) => {
    const { row } = event.active.data.current as { row: { depth: number } }
    dropLevel.start(
      (event.activatorEvent?.target as Element | null)?.closest?.(
        '.data-grid__body-row',
      ),
      row.depth,
      readRowNestingIndent(table),
    )
    onRowDragStart?.(event)
  }

  const rowDragging = useSlice(
    table,
    'rowDragging' as never,
  ) as RowDragOverlayState

  const { rows } = table.getRowModel()

  // Группа раскрылась посреди сессии — индексы места сдвинулись без движения
  // указателя: выровнять их по id до кадра (ADR 0109, §1).
  useIsomorphicLayoutEffect(() => {
    const { activeId, fromIndex, overIndex, overId } = rowDragging
    if (activeId === null || fromIndex === null || overIndex === null) return
    const staleFrom = rows[fromIndex]?.id !== activeId
    const staleOver = overId !== null && rows[overIndex]?.id !== overId
    if (!staleFrom && !staleOver) return
    const indexOf = (id: string, at: number) =>
      rows[at]?.id === id ? at : rows.findIndex(row => row.id === id)
    const from = indexOf(String(activeId), fromIndex)
    const over = overId === null ? overIndex : indexOf(overId, overIndex)
    if (from < 0 || over < 0) return
    ;(
      table as unknown as {
        setRowDragging: (
          updater: (prev: RowDragOverlayState) => RowDragOverlayState,
        ) => void
      }
    ).setRowDragging(prev => ({ ...prev, fromIndex: from, overIndex: over }))
  }, [rows, rowDragging, table])

  const activeId =
    rowDragging.activeId === null ? null : String(rowDragging.activeId)
  const draggableRow = useMemo(
    () => findDraggableRow(rows, activeId),
    [activeId, rows],
  )

  // Перетаскивание запретили на лету или строка ушла — отмена как по Escape.
  const forbidden =
    !!activeId &&
    (!(table.options as { enableRowDragging?: unknown }).enableRowDragging ||
      !(
        draggableRow as { getCanDrag?: () => boolean } | undefined
      )?.getCanDrag?.())
  const lost = !draggableRow
  useIsomorphicLayoutEffect(() => {
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

  const items = useMemo(
    () => getSortableRowIds(rows, virtualRows),
    [rows, virtualRows],
  )

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
      onDragStart={startDrag}
      onDragMove={onRowDragMove}
      // Смена места без движения указателя (автопрокрутка, сдвиг соседей) — то же
      // превью броска (ADR 0108, PV5).
      onDragOver={onRowDragMove}
      onDragEnd={onRowDragEnd}
      onDragCancel={onRowDragCancel}
      onDragAbort={onRowDragAbort}
    >
      <SortableContext
        id="data-grid-sortable-rows"
        items={items}
        strategy={windowedListSortingStrategy}
      >
        {children}
      </SortableContext>
      <DragOverlay
        modifiers={[adjustOverlayPosition]}
        // Облако пропадает при отпускании, строка вспыхивает на месте (ADR 0110).
        dropAnimation={null}
        zIndex={Z_INDEX}
      >
        {draggableRowCell && (
          <OverlayBodyRow
            ref={attachOverlay}
            firstCell={draggableRowCell}
            withCount={draggableRow?.getCanExpand?.() ?? false}
            subRowsCount={draggableRow?.subRows.length}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
