// HeadCell: обычная ячейка заголовка (HeadCell) и перетаскиваемая
// (DraggableHeadCell, useSortable + SortableContext). Пиннинг start/end по листьям
// ячейки-заголовка; контент через flexRender; действия слотов — ActionsZone.
// Опциональные методы фич (sort/resize/drag) вызываются через ?. — плагина может
// не быть в наборе.
import { type CSSProperties, type ReactNode, memo, useMemo } from 'react'

import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent, getAlignContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Header } from '../types'
import type { RegisterSlotParams } from '../core/createSlots'
import { useTableState } from '../core/reactivity'
import { ActionsZone } from './headerActions/ActionsZone'
import { ItemDraggableWrapper } from './dnd'
import { useGridStyles } from './layout'
import { pinnedSideToDom } from './cellPinningParams'
import {
  getColumnSizeVariable,
  getHeaderSizeVariable,
  getPinnedEndOffset,
  getPinnedStartOffset,
} from './columnSizes'

import headCellStyles from '../grid/HeadCell/HeadCell.module.css'

interface TableHeadCellProps {
  layout: 'grid' | 'flex'
  header: Header<any, any, unknown>
  leftHeaderSlot?: RegisterSlotParams<any>[]
  rightHeaderSlot?: RegisterSlotParams<any>[]
  // Абсолютная позиция центрального (непиннутого) виртуализированного заголовка —
  // симметрично телу: вынос из потока, чтобы монтаж на границе окна не рефлоуил ряд.
  absoluteLeft?: number
}

interface DragBindings {
  setNodeRef: (element: HTMLElement | null) => void
  setActivatorNodeRef: (element: HTMLElement | null) => void
  listeners: SyntheticListenerMap | undefined
  attributes: DraggableAttributes
  transformX: number
  isDragging: boolean
}

interface HeadCellViewProps extends TableHeadCellProps {
  disabledSortable: boolean
  /** Drag&Drop-привязки; `null`, когда перетаскивание колонок выключено. */
  drag: DragBindings | null
}

const getAriaSort = (
  header: Header<any, any, unknown>,
): 'ascending' | 'descending' | 'none' | undefined => {
  if (!(header.column.getCanSort?.() ?? false)) {
    return undefined
  }
  const sorted = header.column.getIsSorted?.()
  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'
  return 'none'
}

const getDisabledSortable = (header: Header<any, any, unknown>): boolean =>
  header.column.getIsPinned() !== false ||
  header.column.getIsActionsColumn() ||
  // При presence-based композиции columnDragging может отсутствовать — тогда
  // getCanDrag не определён (перетаскивания нет), что эквивалентно canDrag=false.
  !(header.column.getCanDrag?.() ?? false)

const HeadCellView = ({
  layout,
  header,
  leftHeaderSlot,
  rightHeaderSlot,
  disabledSortable,
  drag,
  absoluteLeft,
}: HeadCellViewProps) => {
  const table = header.getContext().table

  // Коарс-подписка (TODO Phase D: сузить). Нужна для aria-sort/resizing/пиннинга.
  useTableState(table as never, (state: unknown) => state)

  // Пиннинг по листьям ЭТОЙ ячейки (reorder-out: сегмент закреплён, только если
  // все его листья закреплены на одной стороне). start/end (v9).
  const leafCols = header.getLeafHeaders().map(leaf => leaf.column)
  const firstLeaf = leafCols[0] ?? header.column
  const lastLeaf = leafCols.at(-1) ?? header.column
  const isStartPinned =
    leafCols.length > 0 && leafCols.every(c => c.getIsPinned() === 'start')
  const isEndPinned =
    leafCols.length > 0 && leafCols.every(c => c.getIsPinned() === 'end')
  const headerPinned = isStartPinned ? 'start' : isEndPinned ? 'end' : false

  const startCols = (table as any).getStartVisibleLeafColumns() as {
    id: string
  }[]
  const endCols = (table as any).getEndVisibleLeafColumns() as { id: string }[]
  const isLastStartPinnedColumn =
    isStartPinned && startCols.at(-1)?.id === lastLeaf.id
  const isFirstEndPinnedColumn = isEndPinned && endCols[0]?.id === firstLeaf.id

  const startPinnedOffset = isStartPinned
    ? getPinnedStartOffset(table as never, firstLeaf as never)
    : undefined
  const endPinnedOffset = isEndPinned
    ? getPinnedEndOffset(table as never, lastLeaf as never)
    : undefined

  const isActionsColumn = header.column.getIsActionsColumn()
  const enableResizingColumn = header.column.getCanResize?.() ?? false
  const isResizing = header.column.getIsResizing?.() ?? false
  const canRenderSlots = !isActionsColumn
  const isDragging = drag?.isDragging ?? false

  const render = useMemo(() => {
    const content = flexRender(
      header.column.columnDef.header,
      header.getContext(),
    )
    return isActionsColumn ? (
      content
    ) : (
      <CellWrapperTitle>{content}</CellWrapperTitle>
    )
  }, [header, isActionsColumn])

  const gridStyles = useGridStyles(header)

  const cellStyles: CSSProperties = {
    ...gridStyles,
    width:
      header.column.getIsRowActionsColumn() && layout === 'grid'
        ? 'auto'
        : `var(${getColumnSizeVariable(header.id)})`,
    // Центральный виртуализированный заголовок — только динамический left инлайн,
    // статику position/top/height задаёт CSS по data-virtual-cell.
    ...(absoluteLeft !== undefined
      ? { left: absoluteLeft }
      : {
          minWidth: `var(${getHeaderSizeVariable(header.id)})`,
          left: startPinnedOffset,
          right: endPinnedOffset,
        }),
    opacity: isDragging ? 0 : 1,
    transform: disabledSortable
      ? 'none'
      : `translateX(${drag?.transformX || 0}px)`,
  }

  if (
    header.isPlaceholder ||
    (header.column.columnDef as { rowSpan?: number }).rowSpan === 0
  ) {
    return null
  }

  const slots = (
    <>
      {canRenderSlots && (
        <ActionsZone
          slot="leftHeaderSlot"
          opaqueSlot={leftHeaderSlot}
          context={header.getContext()}
        />
      )}
      {render}
      {canRenderSlots && (
        <ActionsZone
          slot="rightHeaderSlot"
          opaqueSlot={rightHeaderSlot}
          context={header.getContext()}
        />
      )}
    </>
  )

  const content: ReactNode = drag ? (
    <ItemDraggableWrapper
      setActivatorNodeRef={drag.setActivatorNodeRef}
      listeners={drag.listeners}
      attributes={drag.attributes}
      isRowDraggingEnable={!disabledSortable}
    >
      {slots}
    </ItemDraggableWrapper>
  ) : (
    slots
  )

  return (
    <div
      ref={drag?.setNodeRef}
      style={cellStyles}
      className={clsx('data-grid__head-cell', headCellStyles.head__cell)}
      role="columnheader"
      aria-colindex={header.column.getIndex() + 1}
      aria-sort={getAriaSort(header)}
      data-column-id={header.column.id}
      data-virtual-cell={absoluteLeft !== undefined || undefined}
      data-cell-pinned={pinnedSideToDom(headerPinned)}
      data-cell-last-left-pinned={isLastStartPinnedColumn}
      data-cell-first-right-pinned={isFirstEndPinnedColumn}
      data-column-resizable={enableResizingColumn}
      data-column-resizing={isResizing}
      data-actions-column-cell={isActionsColumn}
      data-layout={layout}
      data-first-headers-row={header.headerGroup?.getIsFirstGroup() ?? false}
      data-last-headers-row={header.headerGroup?.getIsLastGroup() ?? false}
      data-first-header-in-row={header.getIsFirstHeader()}
      data-last-header-in-row={header.getIsLastHeader()}
      data-header-full-height={header.getIsFullHeightHeader()}
    >
      <CellWrapperContent
        flex={getAlignContent({ isActionsColumn, isRowActionsColumn: false })}
        smallPadding={isActionsColumn}
      >
        {content}
      </CellWrapperContent>
    </div>
  )
}

/**
 * Ячейка заголовка без Drag&Drop-обвязки. Используется, когда перетаскивание
 * колонок выключено — чтобы не платить за useSortable на каждую ячейку.
 */
export const HeadCell = memo((props: TableHeadCellProps) => {
  return (
    <HeadCellView
      {...props}
      disabledSortable={getDisabledSortable(props.header)}
      drag={null}
    />
  )
})

HeadCell.displayName = 'HeadCell'

/**
 * Ячейка заголовка с включённым Drag&Drop: регистрирует колонку в SortableContext;
 * для закреплённых/служебных колонок сортировка отключается через `disabled`.
 */
export const DraggableHeadCell = memo((props: TableHeadCellProps) => {
  const { header } = props

  const disabledSortable = getDisabledSortable(header)

  const {
    setActivatorNodeRef,
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({
    id: header.column.id,
    data: {
      type: 'column',
      orderIndex: header.column.getIndex(),
      // При presence-based композиции columnDragging может отсутствовать — тогда
      // getDraggableIndex не определён, а сортировка всё равно заблокирована.
      draggableIndex: header.column.getDraggableIndex?.() ?? -1,
      disabledSortable,
    },
    disabled: disabledSortable,
  })

  return (
    <HeadCellView
      {...props}
      disabledSortable={disabledSortable}
      drag={{
        setNodeRef,
        setActivatorNodeRef,
        listeners,
        attributes,
        transformX: transform?.x ?? 0,
        isDragging,
      }}
    />
  )
})

DraggableHeadCell.displayName = 'DraggableHeadCell'
