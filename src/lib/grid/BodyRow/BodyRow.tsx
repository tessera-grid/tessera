import { memo, useMemo } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import { Cell, Column, Row } from '@tanstack/react-table'
import { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import { CellSlot } from '../../core/createSlots'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { animateLayoutChanges } from '../../plugins/rowDragging'
import { ItemDraggableWrapper } from '../dnd'
import { BodyCell } from '../BodyCell'
import { LeftEmptyColumn, RightEmptyColumn } from '../VirtualizePaddingColumns'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'

import styles from './BodyRow.module.css'

interface TableBodyRowProps {
  layout: 'grid' | 'flex'

  row: Row<any>
  visibleCells: Cell<any, unknown>[]
  virtualRow: VirtualItem

  virtualColumns: VirtualItem[]
  leafColumns: Column<any, unknown>[]

  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  actionRowSlot?: CellSlot

  headerRowCount: number

  isVirtualColumns: boolean
}

interface BodyRowCellsProps extends TableBodyRowProps {
  isRowInteract: boolean
}

/**
 * @description
 * Отрисовка виртуализированных (или полного набора) колонок в пределах одной строки.
 * Общая часть для перетаскиваемой и обычной строки.
 */
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
        <RightFillerBodyColumn
          hasBorderTop={!row.getIsFirstRow()}
          hasBorderRight
        />
      )}
    </>
  )
}

/**
 * @description
 * Строка тела таблицы без Drag&Drop-обвязки. Используется, когда
 * перетаскивание строк выключено (`enableRowDragging` отсутствует), чтобы не
 * платить за `useSortable`/`SortableContext` на каждый смонтированный при
 * скролле ряд.
 */
export const BodyRow = memo((props: TableBodyRowProps) => {
  const { layout, row, virtualRow, headerRowCount } = props

  useSubscribeStore(() => [
    row.getIsSelected(),
    row.getIsExpanded(),
    row.getCanExpand(),
  ])

  const rowStyles = useMemo(
    () => ({ top: virtualRow.start }),
    [virtualRow.start],
  )

  return (
    <div
      className={clsx('data-grid__body-row', styles.body__row)}
      role="row"
      aria-rowindex={headerRowCount + virtualRow.index + 1}
      aria-expanded={row.getCanExpand() ? row.getIsExpanded() : undefined}
      data-index={virtualRow.index}
      data-selected={row.getIsSelected()}
      data-expanded={row.getCanExpand() ? row.getIsExpanded() : undefined}
      data-group-row={row.getIsGrouped()}
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
 * @description
 * Строка тела таблицы с включённым Drag&Drop. Регистрирует ряд в
 * `SortableContext` и управляет стилями/состоянием перетаскивания.
 */
export const DraggableBodyRow = memo((props: TableBodyRowProps) => {
  const { row, virtualRow, headerRowCount } = props

  useSubscribeStore(() => [
    row.getIsSelected(),
    row.getCanDrag(),
    row.getIsExpanded(),
    row.getCanExpand(),
  ])

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
      aria-expanded={row.getCanExpand() ? row.getIsExpanded() : undefined}
      data-index={virtualRow.index}
      data-selected={row.getIsSelected()}
      data-expanded={row.getCanExpand() ? row.getIsExpanded() : undefined}
      data-group-row={row.getIsGrouped()}
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
