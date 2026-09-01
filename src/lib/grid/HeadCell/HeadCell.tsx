import { CSSProperties, ReactNode, memo, useMemo } from 'react'

import { DraggableAttributes } from '@dnd-kit/core'
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { Header, HeaderContext, flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import {
  getColumnSizeVariable,
  getHeaderSizeVariable,
} from '../../core/createColumns/calculateColumnSizes'
import { RegisterSlotParams } from '../../core/createSlots'
import { RenderSlot } from '../../core/renderSlots'
import { useSubscribeStore } from '../../core/subscribeStore/subscribeStore'
import { useCellPinningParams } from '../../plugins/columnPinning'
import { ItemDraggableWrapper } from '../dnd'
import { CellWrapperContent, getAlignContent } from '../CellWrapperContent'
import { CellWrapperTitle } from '../CellWrapperTitle'
import { useGridStyles } from './gridStyles'

import headCellStyles from './HeadCell.module.css'

interface TableHeadCellProps {
  layout: 'grid' | 'flex'

  header: Header
  leftHeaderSlot?: RegisterSlotParams<HeaderContext>[]
  rightHeaderSlot?: RegisterSlotParams<HeaderContext>[]
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

/**
 * @description
 * Отрисовка ячейки заголовка. Общая часть для перетаскиваемой и обычной ячейки:
 * пиннинг, стили, инжектируемый контент. Drag-специфика приходит через `drag`.
 */
const HeadCellView = ({
  layout,
  header,
  leftHeaderSlot,
  rightHeaderSlot,
  disabledSortable,
  drag,
}: HeadCellViewProps) => {
  const {
    isLeftPinned,
    isRightPinned,
    isLastLeftPinnedColumn,
    getStartLeft,
    getAfterRight,
  } = useCellPinningParams({ column: header.column })

  const isActionsColumn = header.column.getIsActionsColumn()
  const enableResizingColumn = header.column.getCanResize()

  useSubscribeStore(() => [
    header.column.getCanSort(),
    header.column.getIsSorted(),
    header.column.getIsResizing(),
  ])

  const ariaSort = getAriaSort(header)

  const canRenderSlots = !isActionsColumn

  const isDragging = drag?.isDragging ?? false

  const render = useMemo(() => {
    const RenderComponent = header.renderComponent

    if (RenderComponent && isActionsColumn) {
      return <RenderComponent {...header.getContext()} />
    }

    if (RenderComponent) {
      return (
        <CellWrapperTitle>
          <RenderComponent {...header.getContext()} />
        </CellWrapperTitle>
      )
    }

    if (isActionsColumn) {
      return flexRender(
        header.render || header.column.columnDef.header,
        header.getContext(),
      )
    }

    return (
      <CellWrapperTitle>
        {flexRender(
          header.render || header.column.columnDef.header,
          header.getContext(),
        )}
      </CellWrapperTitle>
    )
  }, [header, isActionsColumn])

  const gridStyles = useGridStyles(header)

  const cellStyles: CSSProperties = useMemo(
    () => ({
      ...gridStyles,
      minWidth: `var(${getHeaderSizeVariable(header.id)})`,
      width:
        header.column.getIsRowActionsColumn() && layout === 'grid'
          ? 'auto'
          : `var(${getColumnSizeVariable(header.id)})`,
      left: isLeftPinned ? `${getStartLeft}px` : undefined,
      right: isRightPinned ? `${getAfterRight}px` : undefined,
      opacity: isDragging ? 0 : 1,
      transform: disabledSortable
        ? 'none'
        : `translateX(${drag?.transformX || 0}px)`,
    }),
    [
      gridStyles,
      header.id,
      header.column,
      layout,
      isLeftPinned,
      getStartLeft,
      isRightPinned,
      getAfterRight,
      isDragging,
      disabledSortable,
      drag?.transformX,
    ],
  )

  if (header.isPlaceholder || header.column.columnDef?.rowSpan === 0) {
    return null
  }

  const slots = (
    <>
      {canRenderSlots && (
        <RenderSlot slot={leftHeaderSlot} context={header.getContext()} />
      )}
      {render}
      {canRenderSlots && (
        <RenderSlot slot={rightHeaderSlot} context={header.getContext()} />
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
      aria-colindex={header.column.getIndex()}
      aria-sort={ariaSort}
      data-column-id={header.column.id}
      data-cell-pinned={header.column.getIsPinned()}
      data-cell-last-left-pinned={isLastLeftPinnedColumn}
      data-column-resizable={enableResizingColumn}
      data-column-resizing={header.column.getIsResizing()}
      data-actions-column-cell={isActionsColumn}
      data-layout={layout}
      data-first-headers-row={header.headerGroup.getIsFirstGroup()}
      data-last-headers-row={header.headerGroup.getIsLastGroup()}
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
 * Значение `aria-sort` для заголовка. Проставляется только на сортируемом
 * столбце (`getCanSort()`): `ascending` / `descending` по текущему направлению,
 * иначе `none`. На несортируемом столбце атрибут опускается (`undefined`) — по
 * ARIA `aria-sort='none'` подразумевает сортируемый, но пока не отсортированный
 * столбец.
 */
const getAriaSort = (
  header: Header,
): 'ascending' | 'descending' | 'none' | undefined => {
  if (!header.column.getCanSort()) {
    return undefined
  }

  const sorted = header.column.getIsSorted()

  if (sorted === 'asc') return 'ascending'
  if (sorted === 'desc') return 'descending'

  return 'none'
}

const getDisabledSortable = (header: Header): boolean =>
  header.column.getIsPinned() !== false ||
  header.column.getIsActionsColumn() ||
  !header.column.getCanDrag()

/**
 * @description
 * Ячейка заголовка без Drag&Drop-обвязки. Используется, когда перетаскивание
 * колонок выключено (`enableColumnDragging` отсутствует), чтобы не платить за
 * `useSortable` на каждую отрендеренную при горизонтальном скролле ячейку.
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
 * @description
 * Ячейка заголовка с включённым Drag&Drop. Регистрирует колонку в
 * `SortableContext`; для закреплённых/служебных колонок сортировка отключается
 * через `disabled`.
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
      draggableIndex: header.column.getDraggableIndex(),
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
