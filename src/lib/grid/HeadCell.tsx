// HeadCell: ячейка заголовка (перетаскиваемая обёртка — DraggableHeadCell).
// Пиннинг start/end по листьям ячейки-заголовка; контент через flexRender;
// действия слотов — ActionsZone.
// Опциональные методы фич (sort/resize/drag) вызываются через ?. — плагина может
// не быть в наборе.
import {
  type CSSProperties,
  type ReactNode,
  memo,
  useCallback,
  useId,
  useMemo,
  useRef,
} from 'react'

import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent, getAlignContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Header } from '../types'
import type { RegisterSlotParams } from '../core/createSlots'
import { getDisplayColumnIndex } from '../core/displayColumns'
import { getHeaderRowStart, isCoveredHeader } from '../core/headerSpans'
import {
  NAV_CELL_ATTR,
  getHeaderRowIndex,
  useKeyboardNavigationCell,
} from '../core/keyboardNavigation'
import { useTableState } from '../core/reactivity'
import { highlightRender, useColumnHighlight } from './highlight'
import { flashRender, useColumnFlash } from './flash'
import { usePluginRenderVersion } from '../core/renderVersion'
import { useLocalization } from '../core/localization'
import type { CommonColumnDef } from '../core/commonFeature.types'
import { ActionsZone } from './headerActions/ActionsZone'
import { ActionsHostContext } from './headerActions/useHeldActive'
import { ItemDraggableWrapper } from './dnd'
import { useGridStyles } from './layout'
import { pinnedSideToDom } from './cellPinningParams'
import { useSkeletonMode } from './skeletonMode'
import {
  getColumnSizeVariable,
  getHeaderSizeVariable,
  getVirtualCellLeft,
} from './columnSizes'
import {
  getAriaSort,
  getDisabledSortable,
  getHeadCellState,
  getHeaderPinning,
} from './headCellParams'

import { assignRef } from '../ui/assignRef'
import headCellStyles from '../grid/HeadCell/HeadCell.module.css'
import dataGridStyles from '../grid/DataGrid/DataGrid.module.css'

export interface TableHeadCellProps {
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
  /** Перенос узла ждёт промиса `onColumnDragEnd` (ADR 0114). */
  movePending?: boolean
  /** Drag&Drop-привязки; `null`, когда перетаскивание колонок выключено. */
  drag: DragBindings | null
}

export const HeadCellView = ({
  layout,
  header,
  leftHeaderSlot,
  rightHeaderSlot,
  disabledSortable,
  movePending = false,
  drag,
  absoluteLeft,
}: HeadCellViewProps) => {
  // Новая ссылка на предикат плагина — перерисовка шапки.
  usePluginRenderVersion()
  const table = header.getContext().table

  // Подписка — на значения ячейки, а не на всё состояние: выбор строки или правка ячейки
  // шапку не перерисовывают (ADR 0099, PF5).
  useTableState(table as never, () => getHeadCellState(header))

  // Подсветка колонки (ADR 0080) — по id колонки ячейки: у растянутого листа это
  // плейсхолдер верха цепочки; подсветка листа группу над ним не заливает.
  const columnHighlight = useColumnHighlight(table, header.column.id)
  const highlighted = highlightRender([
    { layer: 'column', state: columnHighlight },
  ])
  // Вспышка итога колонки (ADR 0134) — тем же id колонки ячейки.
  const flashed = flashRender([
    { layer: 'column', entry: useColumnFlash(table, header.column.id) },
  ])

  const {
    firstLeaf,
    headerPinned,
    isLastStartPinnedColumn,
    isFirstEndPinnedColumn,
    startPinnedOffset,
    endPinnedOffset,
  } = getHeaderPinning(header)

  const isActionsColumn = header.column.getIsActionsColumn()
  const enableResizingColumn = header.column.getCanResize?.() ?? false
  // Грип соседа слева заходит в эту ячейку на ползоны (ADR 0111); перед правыми
  // закреплёнными грип внутри своей колонки.
  const previous = header.headerGroup?.headers[header.index - 1]
  const afterResizable =
    !isFirstEndPinnedColumn && (previous?.column.getCanResize?.() ?? false)
  const isResizing = header.column.getIsResizing?.() ?? false
  // Скелет первой загрузки: только названия колонок (ADR 0060, §3).
  const skeleton = useSkeletonMode()
  const canRenderSlots = !isActionsColumn && !skeleton
  const isDragging = drag?.isDragging ?? false

  const labels = useLocalization()
  const serviceLabel = (header.column.columnDef as CommonColumnDef).serviceLabel

  // Имя заголовка — только его текст: кнопки действий в имя не попадают (W17).
  const titleId = useId()
  const hasTitle = !isActionsColumn && !!header.column.columnDef.header

  const render = useMemo(() => {
    const content =
      skeleton && isActionsColumn
        ? null
        : flexRender(header.column.columnDef.header, header.getContext())
    return isActionsColumn ? (
      <>
        {content}
        {serviceLabel && (
          <span className={dataGridStyles['visually-hidden']}>
            {labels[serviceLabel]}
          </span>
        )}
      </>
    ) : (
      <CellWrapperTitle id={titleId}>{content}</CellWrapperTitle>
    )
  }, [header, isActionsColumn, serviceLabel, labels, titleId, skeleton])

  const gridStyles = useGridStyles(header)

  // Клавиатурная навигация: строка шапки — верхняя видимая строка заголовка (< 0).
  const nav = useKeyboardNavigationCell(
    table,
    getHeaderRowIndex(header, table.getHeaderGroups().length),
    firstLeaf.id,
    !isCoveredHeader(header),
    header.id,
  )
  const setDragNodeRef = drag?.setNodeRef
  const navRef = nav?.ref
  const hostRef = useRef<HTMLDivElement | null>(null)
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDragNodeRef?.(node)
      assignRef(navRef, node)
      hostRef.current = node
    },
    [setDragNodeRef, navRef],
  )

  const cellStyles: CSSProperties = {
    ...gridStyles,
    width:
      layout === 'grid' &&
      (header.column.getIsRowActionsColumn() || isFirstEndPinnedColumn)
        ? 'auto'
        : `var(${getColumnSizeVariable(header.id)})`,
    // Центральный виртуализированный заголовок — только динамический left инлайн,
    // статику position/top/height задаёт CSS по data-virtual-cell.
    ...(absoluteLeft !== undefined
      ? { left: getVirtualCellLeft(header.column.id, absoluteLeft) }
      : {
          minWidth: `var(${getHeaderSizeVariable(header.id)})`,
          left: startPinnedOffset,
          right: endPinnedOffset,
        }),
    opacity: isDragging ? 0 : 1,
    // Сдвиг — только у перетаскиваемых: `transform` дал бы ячейке свой слой
    // наложения, и грип ширины соседа слева лёг бы под неё (ADR 0111).
    transform: drag?.transformX
      ? `translateX(${drag.transformX}px)`
      : undefined,
  }

  if (isCoveredHeader(header)) {
    return null
  }

  const headerRowCount = table.getHeaderGroups().length
  const reachesLastRow =
    getHeaderRowStart(header) + header.rowSpan === headerRowCount

  const slots = (
    <ActionsHostContext.Provider value={hostRef}>
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
    </ActionsHostContext.Provider>
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
      ref={setNodeRef}
      tabIndex={nav?.tabIndex}
      onFocus={nav?.onFocus}
      onBlur={nav?.onBlur}
      {...(nav && { [NAV_CELL_ATTR]: '' })}
      data-kn-active={nav?.isActive || undefined}
      style={
        highlighted.style || flashed.style
          ? { ...cellStyles, ...highlighted.style, ...flashed.style }
          : cellStyles
      }
      {...highlighted.attrs}
      {...flashed.attrs}
      className={clsx('data-grid__head-cell', headCellStyles.head__cell)}
      role="columnheader"
      aria-labelledby={hasTitle ? titleId : undefined}
      // Спанящий групповой заголовок — позиция его первого листа.
      aria-colindex={getDisplayColumnIndex(table, firstLeaf.id) + 1}
      aria-sort={getAriaSort(header)}
      aria-busy={movePending || undefined}
      aria-rowspan={header.rowSpan > 1 ? header.rowSpan : undefined}
      aria-colspan={header.colSpan > 1 ? header.colSpan : undefined}
      data-column-id={header.column.id}
      data-virtual-cell={absoluteLeft !== undefined || undefined}
      data-cell-pinned={pinnedSideToDom(headerPinned)}
      data-cell-last-left-pinned={isLastStartPinnedColumn}
      data-cell-first-right-pinned={isFirstEndPinnedColumn}
      data-column-resizable={enableResizingColumn}
      data-after-resizable={afterResizable || undefined}
      data-column-resizing={isResizing}
      data-actions-column-cell={isActionsColumn}
      data-layout={layout}
      data-first-headers-row={header.headerGroup?.getIsFirstGroup() ?? false}
      data-last-headers-row={reachesLastRow}
      data-header-stretched={header.rowSpan > 1 || undefined}
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
