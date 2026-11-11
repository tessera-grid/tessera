// BodyCell. Ячейка тела: пиннинг-стили/атрибуты (start/end) через
// getCellPinningParams, skeleton при fast-scroll, слоты, контент через flexRender
// от columnDef.cell.
import { memo, useContext, useMemo } from 'react'

import clsx from 'clsx'

import { useFastScrollSuppressed } from '../core/fastScroll'
import {
  bodyOf,
  type CellContributionContext,
  cellLayersOf,
  mergeContributions,
  useContributionNode,
  type WindowRow,
} from '../core/bodyContributions'
import { getDisplayColumnIndex } from '../core/displayColumns'
import {
  KeyboardNavigationContext,
  NAV_CELL_ATTR,
  selectNavigationCell,
  useKeyboardNavigationCellBinding,
} from '../core/keyboardNavigation'
import { useLocalization } from '../core/localization'
import { rowSourceOf } from '../core/rowSource'
import {
  cellHighlightKey,
  columnHighlightKey,
  type Highlights,
  type HighlightTargetState,
  rangeHighlightAt,
} from '../core/highlights/highlightFeature'
import { highlightRender } from './highlight'
import { flashRender } from './flash'
import {
  type FlashEntry,
  type Flashes,
  rangeFlashAt,
} from '../core/flashes/flashFeature'
import { cellPendingOf } from '../core/headerActions/actionStatus'
import type { ActionStatus } from '../core/headerActions/actionStatusFeature'
import { cellFailureOf, type Failures } from '../core/failures/failuresFeature'
import { CellFailureMark } from './CellFailureMark'
import {
  cellWrapperClassName,
  getAlignContent,
} from '../grid/CellWrapperContent'
import { cellTitleAttrs } from '../grid/CellWrapperTitle'
import { pinnedCellClass } from './BodyCell/pinnedCellClass'
import { cellValueOf } from '../core/cellValue'
import { alignAttrs, renderCellContent } from './cellContent'
import { renderSkeletonCell, skeletonCellKindOf } from './skeletonCell'
import type { Cell } from '../types'
import { RenderCellSlot, RenderSlot } from '../core/renderSlots'
import type { RegisterSlotParams } from '../core/createSlots'
import { ActionsZone } from './headerActions/ActionsZone'
import { getCellPinningParams, pinnedSideToDom } from './cellPinningParams'
import { getCellExpandingStyles, isIndentColumn } from './cellExpandingStyles'
import { getColumnSizeVariable, getVirtualCellLeft } from './columnSizes'
import { RowRevealContext } from './rowReveal'
import { IconRevealContext } from '../ui/IconButton/iconReveal'

import styles from '../grid/BodyCell/BodyCell.module.css'
import { pluginStateKey } from '../core/definePlugin'
import { KEYBOARD_NAVIGATION } from '../core/keyboardNavigation/model'

/** Срезы, которые читает выбор ячейки (ADR 0195, §1); прочие её не будят. */
const CELL_SLICES = [
  'columnPinning',
  'columnSizing',
  'columnOrder',
  'columnVisibility',
  'highlights',
  'flashes',
  'actionStatus',
  'failures',
  pluginStateKey(KEYBOARD_NAVIGATION),
]

interface TableBodyCellProps {
  cell: Cell<any, any, unknown>
  rowIndex: number
  leftCellSlot?: RegisterSlotParams<any>[]
  rightCellSlot?: RegisterSlotParams<any>[]
  cellSlot?: RegisterSlotParams<any>[]
  actionRowSlot?: RegisterSlotParams<any>[]
  interact?: boolean
  /** Данные строки окна от плагинов — линии дерева (ADR 0170, §3). */
  window?: WindowRow
  /** Ячейка слота перетаскивания: скелет с отступом этой глубины (ADR 0108). */
  slotDepth?: number
  // Абсолютная позиция центральной (непиннутой) виртуализированной ячейки: её `left`
  // от левого края строки. Ячейка выносится из потока (position:absolute), чтобы её
  // монтаж/демонтаж на границе окна не пере-раскладывал соседей. Для пиннутых и
  // невиртуализированных ячеек не задаётся (обычный поток/sticky).
  absoluteLeft?: number
  /** Ячейка липкой копии строки (ADR 0160): в клавиатурной навигации не участвует. */
  copy?: boolean
}

export const BodyCell = memo(
  ({
    cell,
    rowIndex,
    leftCellSlot,
    rightCellSlot,
    cellSlot,
    actionRowSlot,
    interact = true,
    window,
    slotDepth,
    absoluteLeft,
    copy,
  }: TableBodyCellProps) => {
    const table = cell.getContext().table

    // Одна подписка ячейки (ADR 0170, CH5): BodyCell — memo по стабильному `cell`, смена
    // срезов сверху пропом не приходит. Узел — срезы формы колонок (пиннинг, размеры,
    // порядок, видимость), подсветка, вспышка и ожидание на ячейке и её колонке (ADR 0080,
    // ADR 0152), активная ячейка навигации и выборы вкладчиков плагинов; на смену выбора
    // строк, сортировки и раскрытия ячейка не перерисовывается.
    const rowId = cell.row.id
    const columnId = cell.column.id
    const cellKey = cellHighlightKey(rowId, columnId)
    const columnKey = columnHighlightKey(columnId)
    const navigation = useContext(KeyboardNavigationContext)
    const contributors = bodyOf(table).cell
    const contributionContext: CellContributionContext = {
      table: table as never,
      cell,
      rowIndex,
      navigation,
      window,
    }
    const {
      cellHighlight,
      columnHighlight,
      cellFlash,
      columnFlash,
      busy,
      failure,
      navActive,
      contributions,
    } = useContributionNode(
      table,
      contributors,
      contributionContext,
      CELL_SLICES,
      state => {
        const s = state as Record<string, unknown> & {
          highlights?: Highlights
          flashes?: Flashes
          actionStatus?: ActionStatus
          failures?: Failures
        }
        return {
          columnPinning: s.columnPinning,
          columnSizing: s.columnSizing,
          columnOrder: s.columnOrder,
          columnVisibility: s.columnVisibility,
          cellHighlight: (s.highlights?.[cellKey] ??
            rangeHighlightAt(table, s.highlights, rowId, columnId)) as
            HighlightTargetState | undefined,
          columnHighlight: s.highlights?.[columnKey] as
            HighlightTargetState | undefined,
          cellFlash: (s.flashes?.[cellKey] ??
            rangeFlashAt(table, s.flashes, rowId, columnId)) as
            FlashEntry | undefined,
          columnFlash: s.flashes?.[columnKey] as FlashEntry | undefined,
          busy: cellPendingOf(table, s.actionStatus, rowId, columnId) as
            'wave' | 'busy' | undefined,
          failure: s.failures
            ? cellFailureOf(s.failures, rowId, columnId)
            : undefined,
          navActive: selectNavigationCell(table, s, {
            rowIndex,
            columnId,
            participates: navigation && !copy,
          }),
        }
      },
    )
    const highlighted = highlightRender([
      { layer: 'cell', state: cellHighlight },
      { layer: 'column', state: columnHighlight, describe: false },
    ])
    const flashed = flashRender([
      { layer: 'cell', entry: cellFlash },
      { layer: 'column', entry: columnFlash },
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

    // Слот перетаскивания стоит на глубине места броска (ADR 0108, §2).
    const isSlot = slotDepth !== undefined
    const depth = slotDepth ?? cell.row.depth
    const { paddingLeft } = getCellExpandingStyles({
      column: cell.column as never,
      rowDepth: depth,
      table: table as never,
    })

    // Слои плагинов перед содержимым — линии дерева в ячейке отступа (ADR 0170, §3); и при
    // быстрой прокрутке, когда слоты не рисуются.
    const layers = cellLayersOf({
      table: table as never,
      columnId,
      isIndent: isIndentColumn(cell.column as never, table as never),
      depth,
      window,
    })

    const isPinnedColumn = cell.column.getIsPinned()
    const isActionsColumn = cell.column.getIsActionsColumn()
    const isFillColumn = !!cell.column.getServiceColumn()?.fill

    const rowReveal = useContext(RowRevealContext)
    const iconReveal = useMemo(
      () => rowReveal?.of(cell.row.id) ?? null,
      [rowReveal, cell.row.id],
    )

    const isSuppressed = useFastScrollSuppressed()
    // Слот — скелет у колонок данных, служебные пустые (PV1); быстрая прокрутка — у всех
    // ячеек сессии, по виду колонки (FS10).
    const showSkeleton = isSlot ? !isActionsColumn : isSuppressed
    const canRenderSlots = !isActionsColumn && !showSkeleton && !isSlot

    // Клавиатурная навигация: включённая владеет roving tabindex ячейки; `null` без неё.
    const nav = useKeyboardNavigationCellBinding(
      table,
      navActive,
      rowIndex,
      columnId,
    )
    // Вклад плагинов в ячейку (ADR 0170, §3): атрибуты, переменные стиля, tabindex.
    const contributed = mergeContributions(
      contributors,
      contributions,
      contributionContext,
    )
    const labels = useLocalization()
    // Число строк данных группы (ADR 0184, §8) — рядом с её значением, `…` режет только значение.
    const groupCount =
      (cell as { getIsGrouped?: () => boolean }).getIsGrouped?.() &&
      table.options.groupRowCount !== false
        ? rowSourceOf(table).groupRowCount?.(cell.row)
        : undefined
    // Значение меняется и без смены данных: стадия переноса между группами (ADR 0186, §3).
    const { value, overridden } = cellValueOf(cell)
    const render = useMemo(() => {
      if (showSkeleton) {
        return renderSkeletonCell(
          cell.column.id,
          skeletonCellKindOf(cell.column),
          false,
        )
      }
      if (isSuppressed) {
        return null
      }

      // Колонка зоны действий строки (`fill`) — действия слота actionRowSlot (инлайн-кнопки
      // + overflow-кебаб), а не flexRender контента.
      if (isFillColumn) {
        return (
          <ActionsZone
            slot="actionRowSlot"
            opaqueSlot={actionRowSlot}
            context={cell.getContext()}
          />
        )
      }

      const content = renderCellContent(cell, labels, value, overridden)

      // Сервисная колонка — контент без подписи; пустая подпись не рисуется.
      if (isActionsColumn) return content
      if (!content && groupCount === undefined) return null
      return (
        <div {...cellTitleAttrs}>
          {groupCount === undefined ? (
            content
          ) : (
            <span className={styles.group}>
              <span className={styles['group-value']} data-group-value="">
                {content}
              </span>
              <span className={styles['group-count']} data-group-count="">
                {` ${labels.groupRowCount(groupCount)}`}
              </span>
            </span>
          )}
        </div>
      )
    }, [
      cell,
      value,
      overridden,
      groupCount,
      labels,
      isActionsColumn,
      isFillColumn,
      actionRowSlot,
      isSuppressed,
      showSkeleton,
    ])

    return (
      <div
        ref={nav?.ref}
        role={nav ? 'gridcell' : 'cell'}
        className={clsx(
          'data-grid__body-cell',
          styles.body__cell,
          pinnedCellClass(isStartPinned, isEndPinned),
        )}
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
          ...contributed.style,
          ...highlighted.style,
          ...flashed.style,
        }}
        {...contributed.attrs}
        tabIndex={nav ? nav.tabIndex : contributed.tabIndex}
        onFocus={nav?.onFocus}
        onBlur={nav?.onBlur}
        {...(nav && { [NAV_CELL_ATTR]: '' })}
        data-kn-active={nav?.isActive || undefined}
        {...layers.attrs}
        {...highlighted.attrs}
        {...flashed.attrs}
        aria-busy={!!busy || undefined}
        data-pending-wave={busy === 'wave' || undefined}
        data-virtual-cell={absoluteLeft !== undefined || undefined}
        aria-colindex={getDisplayColumnIndex(table, cell.column.id) + 1}
        data-column-id={cell.column.id}
        {...alignAttrs(cell.column)}
        data-cell-pinned={pinnedSideToDom(isPinnedColumn)}
        data-cell-odd-left-pinned={isStartPinned && rowIndex % 2 !== 0}
        data-cell-odd-right-pinned={isEndPinned && rowIndex % 2 !== 0}
        data-cell-last-left-pinned={isLastStartPinnedColumn}
        data-cell-last-right-pinned={isLastEndPinnedColumn}
        data-cell-first-right-pinned={isFirstEndPinnedColumn}
        data-cell-alone-right-pinned={isAloneEndPinnedColumn}
        data-actions-column-cell={isActionsColumn}
        data-cell-interact={interact}
        data-first-cell-in-row={cell.column.getIsFirstColumn()}
        data-last-cell-in-row={cell.column.getIsLastColumn()}
        data-cell-of-first-row={cell.row.getIsFirstRow()}
        data-cell-of-last-row={cell.row.getIsLastRow()}
      >
        {layers.nodes}
        <IconRevealContext.Provider value={iconReveal}>
          {/* Обёртка — разметкой, слоты — компонентами только при непустом слоте (ADR 0208). */}
          <div
            className={cellWrapperClassName({
              flex: getAlignContent({ isActionsColumn, isFillColumn }),
              smallPadding: isActionsColumn,
            })}
          >
            {canRenderSlots && !!leftCellSlot?.length && (
              <RenderSlot slot={leftCellSlot} context={cell.getContext()} />
            )}
            {canRenderSlots && !!cellSlot?.length ? (
              <RenderCellSlot
                slot={cellSlot}
                context={cell.getContext()}
                content={render}
              />
            ) : (
              render
            )}
            {canRenderSlots && !!rightCellSlot?.length && (
              <RenderSlot slot={rightCellSlot} context={cell.getContext()} />
            )}
            {failure && <CellFailureMark table={table} failure={failure} />}
          </div>
        </IconRevealContext.Provider>
      </div>
    )
  },
)

BodyCell.displayName = 'BodyCell'
