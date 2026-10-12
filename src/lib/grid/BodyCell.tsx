// BodyCell. Ячейка тела: пиннинг-стили/атрибуты (start/end) через
// getCellPinningParams, skeleton при fast-scroll, слоты, контент через flexRender
// от columnDef.cell.
import { memo, useMemo, type CSSProperties } from 'react'

import { flexRender } from '@tanstack/react-table'
import clsx from 'clsx'

import { useFastScrollSuppressed } from '../core/fastScroll'
import { useCellSelection } from '../core/cellSelection'
import { getDisplayColumnIndex } from '../core/displayColumns'
import {
  NAV_CELL_ATTR,
  useKeyboardNavigationCell,
} from '../core/keyboardNavigation'
import { useTableState } from '../core/reactivity'
import {
  cellHighlightKey,
  columnHighlightKey,
  type Highlights,
  type HighlightTargetState,
} from '../core/highlights/highlightFeature'
import { highlightRender } from './highlight'
import { usePluginRenderVersion } from '../core/renderVersion'
import { CellWrapperContent, getAlignContent } from '../grid/CellWrapperContent'
import { CellWrapperTitle } from '../grid/CellWrapperTitle'
import { Skeleton } from '../ui/Skeleton'
import type { Cell } from '../types'
import { RenderCellSlot, RenderSlot } from '../core/renderSlots'
import type { RegisterSlotParams } from '../core/createSlots'
import { ActionsZone } from './headerActions/ActionsZone'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getCellExpandingStyles, isIndentColumn } from './cellExpandingStyles'
import { TreeLines } from './TreeLinesLayer'
import { getColumnSizeVariable, getVirtualCellLeft } from './columnSizes'

import styles from '../grid/BodyCell/BodyCell.module.css'

interface TableBodyCellProps {
  layout: 'grid' | 'flex'
  cell: Cell<any, any, unknown>
  rowIndex: number
  leftCellSlot?: RegisterSlotParams<any>[]
  rightCellSlot?: RegisterSlotParams<any>[]
  cellSlot?: RegisterSlotParams<any>[]
  actionRowSlot?: RegisterSlotParams<any>[]
  interact?: boolean
  /** Линии дерева строки (ADR 0102): маска уровней и отросток к детям. */
  treeBranch?: string
  treeOpen?: boolean
  // Абсолютная позиция центральной (непиннутой) виртуализированной ячейки: её `left`
  // от левого края строки. Ячейка выносится из потока (position:absolute), чтобы её
  // монтаж/демонтаж на границе окна не пере-раскладывал соседей. Для пиннутых и
  // невиртуализированных ячеек не задаётся (обычный поток/sticky).
  absoluteLeft?: number
}

export const BodyCell = memo(
  ({
    layout,
    cell,
    rowIndex,
    leftCellSlot,
    rightCellSlot,
    cellSlot,
    actionRowSlot,
    interact = true,
    treeBranch,
    treeOpen,
    absoluteLeft,
  }: TableBodyCellProps) => {
    const table = cell.getContext().table
    // Новая ссылка на предикат плагина (canSelectCell, canEdit…) — перерисовка.
    usePluginRenderVersion()

    // Самоподписка: BodyCell — memo по стабильному `cell`, поэтому смена срезов не
    // приходит сверху новым пропом. Подписка сужена до срезов ФОРМЫ КОЛОНОК, от которых
    // зависят атрибуты/офсеты ячейки (пиннинг/размеры/порядок/видимость) — на смену
    // rowSelection/сортировки/раскрытия ячейка НЕ ре-рендерится (это лишняя работа;
    // контент-реактивность несут сам плагин-компонент ячейки и его useSelector).
    // Подсветка своей ячейки и своей колонки (ADR 0080) — в той же подписке.
    const cellKey = cellHighlightKey(cell.row.id, cell.column.id)
    const columnKey = columnHighlightKey(cell.column.id)
    const { cellHighlight, columnHighlight } = useTableState(
      table as never,
      (state: unknown) => {
        const s = state as Record<string, unknown> & { highlights?: Highlights }
        return {
          columnPinning: s.columnPinning,
          columnSizing: s.columnSizing,
          columnOrder: s.columnOrder,
          columnVisibility: s.columnVisibility,
          cellHighlight: s.highlights?.[cellKey],
          columnHighlight: s.highlights?.[columnKey],
        }
      },
    ) as {
      cellHighlight?: HighlightTargetState
      columnHighlight?: HighlightTargetState
    }
    const highlighted = highlightRender([
      { layer: 'cell', state: cellHighlight },
      { layer: 'column', state: columnHighlight, describe: false },
    ])

    const {
      isStartPinned,
      isEndPinned,
      isLastStartPinnedColumn,
      isLastEndPinnedColumn,
      isFirstEndPinnedColumn,
      isAloneEndPinnedColumn,
      startPinnedOffset,
      endPinnedOffset,
    } = getCellPinningParams(table as never, cell.column as never)

    const { paddingLeft } = getCellExpandingStyles({
      column: cell.column as never,
      rowDepth: cell.row.depth,
      table: table as never,
    })

    // Линии дерева (ADR 0102) — в ячейке отступа: ветки строки и отросток к детям.
    const treeLines =
      treeBranch !== undefined &&
      (cell.row.depth > 0 || !!treeOpen) &&
      isIndentColumn(cell.column as never, table as never)

    const isPinnedColumn = cell.column.getIsPinned()
    const isActionsColumn = cell.column.getIsActionsColumn()
    const isRowActionsColumn = cell.column.getIsRowActionsColumn()

    const isSuppressed = useFastScrollSuppressed()
    const showSkeleton = isSuppressed && !isActionsColumn && !isPinnedColumn
    const canRenderSlots = !isActionsColumn && !showSkeleton

    // Выделение ячеек (плагин cellSelection): гранулярная подписка, `null` без
    // плагина/для невыбираемых ячеек — тогда ниже не вешаем ни атрибутов, ни
    // обработчиков, ни tabindex (шов инертен, см. ADR 0029).
    const cellSel = useCellSelection(cell)
    // Клавиатурная навигация (плагин keyboardNavigation): при наличии владеет
    // roving tabindex ячейки; `null` без плагина.
    const nav = useKeyboardNavigationCell(table, rowIndex, cell.column.id)
    const edgeColor = (on: boolean) =>
      on ? 'var(--tsr-comp-cell-selected-border-color)' : 'transparent'
    const selectionStyle = (
      cellSel?.isSelected
        ? {
            '--tsr-sel-edge-top': edgeColor(cellSel.edgeTop),
            '--tsr-sel-edge-right': edgeColor(cellSel.edgeRight),
            '--tsr-sel-edge-bottom': edgeColor(cellSel.edgeBottom),
            '--tsr-sel-edge-left': edgeColor(cellSel.edgeLeft),
          }
        : undefined
    ) as CSSProperties | undefined

    const render = useMemo(() => {
      if (showSkeleton) {
        return <Skeleton width="50%" height={16} animation={false} />
      }
      if (isSuppressed) {
        return null
      }

      // Колонка действий строки — зона действий в слоте actionRowSlot (инлайн-кнопки
      // + overflow-кебаб), а не flexRender контента.
      if (isRowActionsColumn) {
        return (
          <ActionsZone
            slot="actionRowSlot"
            opaqueSlot={actionRowSlot}
            context={cell.getContext()}
          />
        )
      }

      const content = flexRender(cell.column.columnDef.cell, cell.getContext())

      // Сервисная колонка — контент без CellWrapperTitle.
      return isActionsColumn ? (
        content
      ) : (
        <CellWrapperTitle>{content}</CellWrapperTitle>
      )
    }, [
      cell,
      isActionsColumn,
      isRowActionsColumn,
      actionRowSlot,
      isSuppressed,
      showSkeleton,
    ])

    return (
      <div
        ref={nav?.ref}
        role={nav ? 'gridcell' : 'cell'}
        className={clsx('data-grid__body-cell', styles.body__cell)}
        style={{
          width: `var(${getColumnSizeVariable(cell.column.id)})`,
          // Центральная виртуализированная ячейка — только динамический left инлайн;
          // статичные position/top/height задаёт CSS по data-virtual-cell (меньше
          // записей стиля на монтаж). Пиннутая/поточная — minWidth+sticky-офсеты.
          ...(absoluteLeft !== undefined
            ? { left: getVirtualCellLeft(cell.column.id, absoluteLeft) }
            : {
                minWidth: `var(${getColumnSizeVariable(cell.column.id)})`,
                left: startPinnedOffset,
                right: endPinnedOffset,
              }),
          paddingLeft,
          ...selectionStyle,
          ...highlighted.style,
        }}
        tabIndex={nav ? nav.tabIndex : cellSel?.tabIndex}
        onFocus={nav?.onFocus}
        onBlur={nav?.onBlur}
        {...(nav && { [NAV_CELL_ATTR]: '' })}
        data-kn-active={nav?.isActive || undefined}
        data-cell-selectable={cellSel ? true : undefined}
        onMouseDown={
          cellSel
            ? event => {
                // Начинаем/сбрасываем выделение только ЛЕВОЙ кнопкой. Правый клик
                // (button 2) шлёт mousedown до contextmenu — не должен рвать
                // мультивыбор; выделением target'а по правому клику владеет
                // контекстное меню (setFocusedCell, ADR 0030).
                if (event.button !== 0) {
                  return
                }
                cellSel.onMouseDown(event)
                // Фокус на ячейку — чтобы нативное copy-событие всплыло сюда.
                event.currentTarget.focus()
              }
            : undefined
        }
        onMouseEnter={cellSel ? cellSel.onMouseEnter : undefined}
        aria-selected={nav && cellSel ? cellSel.isSelected : undefined}
        data-cell-selected={cellSel?.isSelected || undefined}
        data-cell-focused={cellSel?.isFocused || undefined}
        {...highlighted.attrs}
        data-virtual-cell={absoluteLeft !== undefined || undefined}
        aria-colindex={getDisplayColumnIndex(table, cell.column.id) + 1}
        data-column-id={cell.column.id}
        data-tree-depth={treeLines ? cell.row.depth : undefined}
        data-cell-pinned={pinnedSideToDom(isPinnedColumn)}
        data-cell-odd-left-pinned={isStartPinned && rowIndex % 2 !== 0}
        data-cell-odd-right-pinned={isEndPinned && rowIndex % 2 !== 0}
        data-cell-last-left-pinned={isLastStartPinnedColumn}
        data-cell-last-right-pinned={isLastEndPinnedColumn}
        data-cell-first-right-pinned={isFirstEndPinnedColumn}
        data-cell-alone-right-pinned={isAloneEndPinnedColumn}
        data-actions-column-cell={isActionsColumn}
        data-cell-interact={interact}
        data-layout={layout}
        data-first-cell-in-row={cell.column.getIsFirstColumn()}
        data-last-cell-in-row={cell.column.getIsLastColumn()}
        data-cell-of-first-row={cell.row.getIsFirstRow()}
        data-cell-of-last-row={cell.row.getIsLastRow()}
      >
        {treeLines && <TreeLines branch={treeBranch} open={!!treeOpen} />}
        <CellWrapperContent
          flex={getAlignContent({
            isActionsColumn,
            isRowActionsColumn: cell.column.getIsRowActionsColumn(),
          })}
          smallPadding={isActionsColumn}
        >
          {canRenderSlots && (
            <RenderSlot slot={leftCellSlot} context={cell.getContext()} />
          )}
          {canRenderSlots ? (
            <RenderCellSlot
              slot={cellSlot}
              context={cell.getContext()}
              content={render}
            />
          ) : (
            render
          )}
          {canRenderSlots && (
            <RenderSlot slot={rightCellSlot} context={cell.getContext()} />
          )}
        </CellWrapperContent>
      </div>
    )
  },
)

BodyCell.displayName = 'BodyCell'
