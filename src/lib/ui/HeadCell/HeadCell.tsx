import { CSSProperties, memo, useMemo } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import { Header, HeaderContext, flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import {
  getColumnSizeVariable,
  getHeaderSizeVariable,
} from '../../core/createColumns/calculateColumnSizes'
import { RegisterSlotParams } from '../../core/createSlots'
import { RenderSlot } from '../../core/renderSlots'
import { useCellPinningParams } from '../../plugins/columnPinning'
import { ItemDraggableWrapper } from '../../plugins/utils/ItemDraggableWrapper'
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

/**
 * @description
 * Компонент ячейки заголовка таблицы.
 * Может включать в себя базовую стилизацию и стилизацию расширений,
 * подключения системных расширений, а также управление отображением инжектируемого контента.
 */
export const HeadCell = memo(
  ({ layout, header, leftHeaderSlot, rightHeaderSlot }: TableHeadCellProps) => {
    const {
      isLeftPinned,
      isRightPinned,
      isLastLeftPinnedColumn,
      getStartLeft,
      getAfterRight,
    } = useCellPinningParams({ column: header.column })

    const isActionsColumn = header.column.getIsActionsColumn()
    const enableResizingColumn = header.column.getCanResize()
    const disabledSortable =
      isLeftPinned ||
      isRightPinned ||
      isActionsColumn ||
      !header.column.getCanDrag()

    const canRenderSlots = !isActionsColumn

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
          : `translateX(${transform?.x || 0}px)`,
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
        transform?.x,
      ],
    )

    if (header.isPlaceholder || header.column.columnDef?.rowSpan === 0) {
      return null
    }

    return (
      <div
        ref={setNodeRef}
        style={cellStyles}
        className={clsx('data-grid__head-cell', headCellStyles.head__cell)}
        role="columnheader"
        aria-colindex={header.column.getIndex()}
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
          <ItemDraggableWrapper
            setActivatorNodeRef={setActivatorNodeRef}
            listeners={listeners}
            attributes={attributes}
            isRowDraggingEnable={!disabledSortable}
          >
            {canRenderSlots && (
              <RenderSlot slot={leftHeaderSlot} context={header.getContext()} />
            )}
            {render}
            {canRenderSlots && (
              <RenderSlot
                slot={rightHeaderSlot}
                context={header.getContext()}
              />
            )}
          </ItemDraggableWrapper>
        </CellWrapperContent>
      </div>
    )
  },
)

HeadCell.displayName = 'HeadCell'
