// HeadCell: ячейка заголовка (перетаскивание приносит декоратор плагина).
// Пиннинг start/end по листьям ячейки-заголовка; контент через flexRender;
// действия слотов — ActionsZone.
// Опциональные методы фич (sort/resize/drag) вызываются через ?. — плагина может
// не быть в наборе.
import {
  type CSSProperties,
  memo,
  useCallback,
  useId,
  useMemo,
  useRef,
} from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { CellWrapperContent, getAlignContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import type { Header } from '../types'
import { alignAttrs } from './cellContent'
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
import { useLocalization } from '../core/localization'
import { ActionsZone } from './headerActions/ActionsZone'
import { ActionsHostContext } from './headerActions/useHeldActive'
import { pinnedSideToDom } from './cellPinningParams'
import { useSkeletonMode } from './skeletonMode'
import { getHeaderSizeVariable, getVirtualCellLeft } from './columnSizes'
import {
  getAriaSort,
  getHeadCellState,
  getHeaderPinning,
} from './headCellParams'

import type { HeadDragBinding } from '../core/pluginWrappers'
import { assignRef } from '../ui/assignRef'
import headCellStyles from '../grid/HeadCell/HeadCell.module.css'
import hidden from '../ui/visuallyHidden.module.css'

export interface TableHeadCellProps {
  header: Header<any, any, unknown>
  leftHeaderSlot?: RegisterSlotParams<any>[]
  rightHeaderSlot?: RegisterSlotParams<any>[]
  // Абсолютная позиция центрального (непиннутого) виртуализированного заголовка —
  // симметрично телу: вынос из потока, чтобы монтаж на границе окна не рефлоуил ряд.
  absoluteLeft?: number
}

interface HeadCellViewProps extends TableHeadCellProps {
  /** Привязка к перетаскиванию от декоратора плагина (ADR 0168, §2). */
  drag?: HeadDragBinding
}

export const HeadCellView = ({
  header,
  leftHeaderSlot,
  rightHeaderSlot,
  drag,
  absoluteLeft,
}: HeadCellViewProps) => {
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
  // Следующий — первый правый закреплённый: отметка вместо `:has` по соседу (GB13).
  const next = header.headerGroup?.headers[header.index + 1]
  const beforeEndPinned =
    !!next && getHeaderPinning(next).isFirstEndPinnedColumn
  const isResizing = header.column.getIsResizing?.() ?? false
  // Скелет первой загрузки: только названия колонок (ADR 0060, §3).
  const skeleton = useSkeletonMode()
  const canRenderSlots = !isActionsColumn && !skeleton
  const isDragging = drag?.dragging ?? false

  const labels = useLocalization()
  const serviceLabel = header.column.getServiceColumn()?.label

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
          <span className={hidden['visually-hidden']} data-visually-hidden="">
            {serviceLabel(labels)}
          </span>
        )}
      </>
    ) : (
      <CellWrapperTitle id={titleId}>{content}</CellWrapperTitle>
    )
  }, [header, isActionsColumn, serviceLabel, labels, titleId, skeleton])

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

  // Растянутый лист — на свои строки шапки; строка над нижней выше на линию (ADR 0207, §2).
  const stretched =
    header.rowSpan > 1
      ? {
          height: `calc((var(--tsr-comp-row-height) + 1px) * ${header.rowSpan} - 1px)`,
          alignSelf: 'flex-start' as const,
        }
      : undefined
  const cellStyles: CSSProperties = {
    // Ширина заголовка — его листья: у листа это ширина колонки, у группы — их сумма.
    width: `var(${getHeaderSizeVariable(header.id)})`,
    ...stretched,
    // Центральный виртуализированный заголовок — только динамический left инлайн,
    // статику position/top/height задаёт CSS по data-virtual-cell.
    ...(absoluteLeft !== undefined
      ? { left: getVirtualCellLeft(firstLeaf.id, absoluteLeft) }
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

  // Заголовок группы и последний видимый лист группы — граница группы в шапке (ADR 0207, §4).
  const isGroup = header.column.columns.length > 0
  const parent = header.column.parent
  const groupEnd =
    isGroup ||
    (!!parent &&
      parent
        .getLeafColumns()
        .filter(column => column.getIsVisible())
        .at(-1)?.id === header.column.id)

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
      aria-busy={drag?.busy || undefined}
      aria-rowspan={header.rowSpan > 1 ? header.rowSpan : undefined}
      aria-colspan={header.colSpan > 1 ? header.colSpan : undefined}
      data-column-id={header.column.id}
      {...alignAttrs(header.column)}
      data-virtual-cell={absoluteLeft !== undefined || undefined}
      data-cell-pinned={pinnedSideToDom(headerPinned)}
      data-cell-last-left-pinned={isLastStartPinnedColumn}
      data-cell-first-right-pinned={isFirstEndPinnedColumn}
      data-before-right-pinned={beforeEndPinned || undefined}
      data-column-resizable={enableResizingColumn}
      data-after-resizable={afterResizable || undefined}
      data-column-resizing={isResizing}
      data-actions-column-cell={isActionsColumn}
      data-first-headers-row={header.headerGroup?.getIsFirstGroup() ?? false}
      data-last-headers-row={reachesLastRow}
      data-header-stretched={header.rowSpan > 1 || undefined}
      data-header-group={isGroup || undefined}
      data-group-end={groupEnd || undefined}
      data-first-header-in-row={header.getIsFirstHeader()}
      data-last-header-in-row={header.getIsLastHeader()}
      data-header-full-height={header.getIsFullHeightHeader()}
    >
      <CellWrapperContent
        flex={getAlignContent({ isActionsColumn, isFillColumn: false })}
        smallPadding={isActionsColumn}
      >
        {slots}
      </CellWrapperContent>
    </div>
  )
}

/** Ячейка заголовка; перетаскивание колонок приносит её декоратор плагина (ADR 0168, §2). */
export const HeadCell = memo(
  (props: TableHeadCellProps & { drag?: HeadDragBinding }) => (
    <HeadCellView {...props} />
  ),
)

HeadCell.displayName = 'HeadCell'
