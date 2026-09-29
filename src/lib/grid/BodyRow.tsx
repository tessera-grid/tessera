// BodyRow: ряд тела (перетаскиваемая обёртка — DraggableBodyRow). Виртуализация
// приходит пропсами virtualRow/virtualColumns. Реактивность через useTableState. Row-методы фич
// (getIsSelected/getIsExpanded/getCanDrag) вызываются через ?. — плагина может
// не быть в наборе.
import { memo, useMemo } from 'react'

import type { VirtualItem } from '@tanstack/react-virtual'
import clsx from 'clsx'

import type { Cell, Column, Row } from '../types'
import type { CellSlot } from '../core/createSlots'
import { useTableState } from '../core/reactivity'
import {
  NAV_ROW_ATTR,
  useKeyboardNavigationRow,
} from '../core/keyboardNavigation'
import { BodyCell } from './BodyCell'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'

import styles from '../grid/BodyRow/BodyRow.module.css'

export interface TableBodyRowProps {
  layout: 'grid' | 'flex'
  row: Row<any, any>
  visibleCells: Cell<any, any, unknown>[]
  virtualRow: VirtualItem
  virtualColumns: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  cellSlot?: CellSlot
  actionRowSlot?: CellSlot
  /** `aria-rowindex` первой строки тела минус 1: строки шапки + строки прошлых страниц. */
  ariaRowIndexBase: number
  /** Строки несут `aria-selected` (grid с rowSelection). */
  selectableRows?: boolean
  /** Уровень и позиция строки в treegrid. */
  treeAria?: TreeAria
  isVirtualColumns: boolean
}

export interface TreeAria {
  'aria-level': number
  'aria-setsize': number
  'aria-posinset': number
}

interface BodyRowCellsProps extends TableBodyRowProps {
  isRowInteract: boolean
}

/**
 * Пер-строчная подписка на СВОИ срезы: строка ре-рендерится только когда меняется её
 * собственный выбор/раскрытие (а не любой выбор/раскрытие в таблице) либо группировка.
 * `expanded` бывает `true` (все) или картой по id.
 */
export const useRowStateSubscription = (row: Row<any, any>) => {
  const table = (row as unknown as { table: never }).table
  useTableState(table, (state: unknown) => {
    const s = state as {
      rowSelection?: Record<string, boolean>
      expanded?: true | Record<string, boolean>
      grouping?: unknown
    }
    return {
      selected: s.rowSelection?.[row.id] ?? false,
      expanded: s.expanded === true ? true : (s.expanded?.[row.id] ?? false),
      grouping: s.grouping,
    }
  })
}

export const BodyRowCells = ({
  layout,
  row,
  virtualRow,
  visibleCells,
  virtualColumns,
  leafColumns,
  leftCellSlot,
  rightCellSlot,
  cellSlot,
  actionRowSlot,
  isVirtualColumns,
  isRowInteract,
}: BodyRowCellsProps) => {
  if (isVirtualColumns) {
    const cellProps = (
      cell: Cell<any, any, unknown>,
      absoluteLeft?: number,
    ) => ({
      layout,
      cell,
      rowIndex: virtualRow?.index,
      leftCellSlot,
      rightCellSlot,
      cellSlot,
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
        {startCells.map(cell => (
          <BodyCell key={cell.id} {...cellProps(cell)} />
        ))}
        <VirtualCenterSpacer />
        {centerCells.map(({ cell, start }) => (
          <BodyCell key={cell.id} {...cellProps(cell, start)} />
        ))}
        {endCells.map(cell => (
          <BodyCell key={cell.id} {...cellProps(cell)} />
        ))}
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
            cellSlot={cellSlot}
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

/** `aria-selected` только у выбираемых строк грида с rowSelection. */
export const getAriaSelected = (
  row: Row<any, any>,
  selectableRows?: boolean,
) =>
  selectableRows && (row.getCanSelect?.() ?? false)
    ? (row.getIsSelected?.() ?? false)
    : undefined

/**
 * Ряд тела без Drag&Drop-обвязки. Используется, когда перетаскивание строк
 * выключено — чтобы не платить за useSortable на каждый смонтированный ряд.
 */
export const BodyRow = memo((props: TableBodyRowProps) => {
  const { layout, row, virtualRow, ariaRowIndexBase } = props

  useRowStateSubscription(row)
  const nav = useKeyboardNavigationRow(
    (row as unknown as { table: unknown }).table,
    virtualRow.index,
  )

  const canExpand = row.getCanExpand?.() ?? false
  const isExpanded = row.getIsExpanded?.() ?? false

  const rowStyles = useMemo(
    () => ({ top: virtualRow.start }),
    [virtualRow.start],
  )

  return (
    <div
      {...(nav && {
        ref: nav.ref,
        tabIndex: nav.tabIndex,
        onFocus: nav.onFocus,
        onBlur: nav.onBlur,
        [NAV_ROW_ATTR]: '',
      })}
      data-kn-active={nav?.isActive || undefined}
      className={clsx('data-grid__body-row', styles.body__row)}
      role="row"
      aria-rowindex={ariaRowIndexBase + virtualRow.index + 1}
      aria-expanded={canExpand ? isExpanded : undefined}
      aria-selected={getAriaSelected(row, props.selectableRows)}
      {...props.treeAria}
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
