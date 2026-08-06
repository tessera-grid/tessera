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

  isVirtualColumns: boolean
}

/**
 * @description
 * Компонент строки тела таблицы. Реализует отображение виртуализированных колонок в этой строке,
 * а также стилизацию такой строки.
 */
export const BodyRow = memo(
  ({
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
  }: TableBodyRowProps) => {
    useSubscribeStore(() => [row.getIsSelected(), row.getCanDrag()])

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

    const renderCells = () => {
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

    return (
      <div
        ref={node => {
          setDraggableNodeRef(node)
          setDroppableNodeRef(node)
        }}
        className={clsx('data-grid__body-row', styles.body__row)}
        role="row"
        aria-rowindex={virtualRow.index}
        data-index={virtualRow.index}
        data-selected={row.getIsSelected()}
        data-row-odd={virtualRow.index % 2 !== 0}
        data-row-draggable={isDragging}
        data-row-interact={isRowInteract}
        data-last-row={row.getIsLastRow()}
        data-layout={layout}
        style={rowStyles}
      >
        <ItemDraggableWrapper
          isRowDraggingEnable={row.getCanDrag()}
          setActivatorNodeRef={setActivatorNodeRef}
          listeners={listeners}
          attributes={attributes}
        >
          {renderCells()}
        </ItemDraggableWrapper>
      </div>
    )
  },
)

BodyRow.displayName = 'BodyRow'
