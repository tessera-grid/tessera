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
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
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

/**
 * Пер-строчная подписка на СВОИ срезы: строка ре-рендерится только когда меняется её
 * собственный выбор/раскрытие (а не любой выбор/раскрытие в таблице) либо группировка.
 * Раньше строки держали коарс-подписку на весь стейт — выбор одной строки ре-рендерил
 * все смонтированные строки. `expanded` бывает `true` (все) или картой по id.
 */
const useRowStateSubscription = (row: Row<any, any>) => {
  const table = (row as unknown as { table: never }).table
  useTableState(table, (state: unknown) => {
    const s = state as {
      rowSelection?: Record<string, boolean>
      expanded?: true | Record<string, boolean>
      grouping?: unknown
    }
    return {
      selected: s.rowSelection?.[row.id] ?? false,
      expanded: s.expanded === true ? true : s.expanded?.[row.id] ?? false,
      grouping: s.grouping,
    }
  })
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
    const cellProps = (cell: Cell<any, any, unknown>, absoluteLeft?: number) => ({
      key: cell.id,
      layout,
      cell,
      rowIndex: virtualRow?.index,
      leftCellSlot,
      rightCellSlot,
      actionRowSlot,
      interact: isRowInteract,
      absoluteLeft,
    })

    // Пиннутые ячейки — sticky-сиблинги в потоке; центральные — position:absolute по
    // своему `left` (вне потока), поэтому их монтаж на границе окна не рефлоуит строку.
    // Спейсер постоянной ширины держит поток (экстент + отсутствие свободного места).
    const startCells: Cell<any, any, unknown>[] = []
    const endCells: Cell<any, any, unknown>[] = []
    const centerCells: { cell: Cell<any, any, unknown>; start: number }[] = []
    for (const virtualColumn of virtualColumns) {
      const cell = visibleCells[virtualColumn.index]
      const pinned = cell.column.getIsPinned()
      if (pinned === 'start') startCells.push(cell)
      else if (pinned === 'end') endCells.push(cell)
      else centerCells.push({ cell, start: virtualColumn.start })
    }

    return (
      <>
        {startCells.map(cell => <BodyCell {...cellProps(cell)} />)}
        <VirtualCenterSpacer />
        {centerCells.map(({ cell, start }) => <BodyCell {...cellProps(cell, start)} />)}
        {endCells.map(cell => <BodyCell {...cellProps(cell)} />)}
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

  useRowStateSubscription(row)

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
      data-row-id={row.id}
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

  useRowStateSubscription(row)

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
      data-row-id={row.id}
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
