// Cutover (grid) — v9-порт BodyRow: обычный ряд (BodyRow) и перетаскиваемый
// (DraggableBodyRow, useSortable + SortableContext). Виртуализация приходит
// пропсами virtualRow/virtualColumns. Реактивность через useTableState (в v8 —
// useSubscribeStore). Row-методы фич (getIsSelected/getIsExpanded/getCanDrag)
// вызываются через ?. — плагина может не быть в наборе.
import { memo, useMemo } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { Cell, Column, Row } from '../types'
import type { CellSlot } from '../core/createSlots'
import { useTableState } from '../core/reactivity'
import { animateLayoutChanges } from '../plugins/rowDragging'
import { ItemDraggableWrapper } from './dnd'
import { BodyCell } from './BodyCell'
import { LeftEmptyColumn, RightEmptyColumn } from './VirtualizePaddingColumns'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'

import styles from '../grid/BodyRow/BodyRow.module.css'

interface TableBodyRowProps {
  layout: 'grid' | 'flex'
  row: Row<any, any>
  visibleCells: Cell<any, any, unknown>[]
  virtualRow: VirtualItem
  virtualColumns: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  actionRowSlot?: CellSlot
  headerRowCount: number
  isVirtualColumns: boolean
}

interface BodyRowCellsProps extends TableBodyRowProps {
  isRowInteract: boolean
}

const BodyRowCells = ({
  layout,
  row,
  virtualRow,
  visibleCells,
  virtualColumns,
  leafColumns,
  leftCellSlot,
  rightCellSlot,
  actionRowSlot,
  isVirtualColumns,
  isRowInteract,
}: BodyRowCellsProps) => {
  if (isVirtualColumns) {
    return (
      <>
        <LeftEmptyColumn />
        {virtualColumns.map(virtualColumn => {
          const cell = visibleCells[virtualColumn.index]
          return (
            <BodyCell
              key={cell.id}
              layout={layout}
              cell={cell}
              rowIndex={virtualRow?.index}
              leftCellSlot={leftCellSlot}
              rightCellSlot={rightCellSlot}
              actionRowSlot={actionRowSlot}
              interact={isRowInteract}
            />
          )
        })}
        <RightEmptyColumn />
      </>
    )
  }

  return (
    <>
      {leafColumns.map(column => {
        const cell = visibleCells[column.getIndex()]
        return (
          <BodyCell
            key={cell.id}
            layout={layout}
            cell={cell}
            rowIndex={virtualRow?.index}
            leftCellSlot={leftCellSlot}
            rightCellSlot={rightCellSlot}
            actionRowSlot={actionRowSlot}
            interact={isRowInteract}
          />
        )
      })}
      {!row.getVisibleCells().at(-1)?.column.getIsActionsColumn() && (
        <RightFillerBodyColumn hasBorderTop={!row.getIsFirstRow()} hasBorderRight />
      )}
    </>
  )
}

/**
 * Ряд тела без Drag&Drop-обвязки. Используется, когда перетаскивание строк
 * выключено — чтобы не платить за useSortable на каждый смонтированный ряд.
 */
export const BodyRow = memo((props: TableBodyRowProps) => {
  const { layout, row, virtualRow, headerRowCount } = props

  // Коарс-подписка (TODO Phase D: сузить до rowSelection/expanded).
  useTableState((row as unknown as { table: never }).table, (state: unknown) => state)

  const canExpand = row.getCanExpand?.() ?? false
  const isExpanded = row.getIsExpanded?.() ?? false

  const rowStyles = useMemo(() => ({ top: virtualRow.start }), [virtualRow.start])

  return (
    <div
      className={clsx('data-grid__body-row', styles.body__row)}
      role="row"
      aria-rowindex={headerRowCount + virtualRow.index + 1}
      aria-expanded={canExpand ? isExpanded : undefined}
      data-index={virtualRow.index}
      data-selected={row.getIsSelected?.() ?? false}
      data-expanded={canExpand ? isExpanded : undefined}
      data-group-row={row.getIsGrouped?.() ?? false}
      data-row-odd={virtualRow.index % 2 !== 0}
      data-row-interact
      data-last-row={row.getIsLastRow()}
      data-layout={layout}
      style={rowStyles}
    >
      <BodyRowCells {...props} isRowInteract />
    </div>
  )
})

BodyRow.displayName = 'BodyRow'

/**
 * Ряд тела с включённым Drag&Drop: регистрирует ряд в SortableContext и управляет
 * стилями/состоянием перетаскивания (offset-индикатор вложенности через CSS-var).
 */
export const DraggableBodyRow = memo((props: TableBodyRowProps) => {
  const { row, virtualRow, headerRowCount } = props

  // Коарс-подписка (TODO Phase D: сузить до selection/drag/expanded).
  useTableState((row as unknown as { table: never }).table, (state: unknown) => state)

  const canExpand = row.getCanExpand?.() ?? false
  const isExpanded = row.getIsExpanded?.() ?? false

  const {
    setActivatorNodeRef,
    attributes,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    overIndex,
    isDragging,
  } = useSortable({
    id: row.id,
    data: {
      type: 'row',
      virtualIndex: virtualRow.index,
      row,
      parentRow: row.getParentRow(),
    },
    animateLayoutChanges,
  })

  const isRowInteract = overIndex === -1

  const rowStyles = useMemo(
    () => ({
      top: virtualRow.start,
      transform: `translate3d(var(--draggable-row-${row.id}-offset-left, 0px), ${transform?.y ?? 0}px, 0px)`,
    }),
    [row.id, transform?.y, virtualRow.start],
  )

  return (
    <div
      ref={node => {
        setDraggableNodeRef(node)
        setDroppableNodeRef(node)
      }}
      className={clsx('data-grid__body-row', styles.body__row)}
      role="row"
      aria-rowindex={headerRowCount + virtualRow.index + 1}
      aria-expanded={canExpand ? isExpanded : undefined}
      data-index={virtualRow.index}
      data-selected={row.getIsSelected?.() ?? false}
      data-expanded={canExpand ? isExpanded : undefined}
      data-group-row={row.getIsGrouped?.() ?? false}
      data-row-odd={virtualRow.index % 2 !== 0}
      data-row-draggable={isDragging}
      data-row-interact={isRowInteract}
      data-last-row={row.getIsLastRow()}
      data-layout={props.layout}
      style={rowStyles}
    >
      <ItemDraggableWrapper
        isRowDraggingEnable={row.getCanDrag()}
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
        attributes={attributes}
      >
        <BodyRowCells {...props} isRowInteract={isRowInteract} />
      </ItemDraggableWrapper>
    </div>
  )
})

DraggableBodyRow.displayName = 'DraggableBodyRow'
