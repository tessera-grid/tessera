// BodyRow: ряд тела (перетаскиваемая обёртка — DraggableBodyRow). Виртуализация
// приходит пропсами virtualRow/virtualColumns. Реактивность через useTableState. Row-методы фич
// (getIsSelected/getIsExpanded/getCanDrag) вызываются через ?. — плагина может
// не быть в наборе.
import { memo, useContext, useMemo } from 'react'

import type { VirtualItem } from '../../vendor/tanstack-virtual/react-virtual'
import clsx from 'clsx'

import type { Cell, Column, Row } from '../types'
import { isRowExpandedIn } from '../core/expandAll'
import type { CellSlot } from '../core/createSlots'
import type { RowDragBinding } from '../core/pluginWrappers'
import { assignRef } from '../ui/assignRef'
import {
  bodyOf,
  mergeContributions,
  type RowContributionContext,
  useContributionNode,
  type WindowRow,
} from '../core/bodyContributions'
import { hasExpandToggle } from '../core/keyboardActions'
import { useRowDraftMark } from '../core/drafts/drafts'
import {
  type Highlights,
  type HighlightTargetState,
  rowHighlightKey,
} from '../core/highlights/highlightFeature'
import { highlightRender } from './highlight'
import { flashRender } from './flash'
import type { FlashEntry, Flashes } from '../core/flashes/flashFeature'
import {
  KeyboardNavigationContext,
  NAV_ROW_ATTR,
  useKeyboardNavigationRow,
} from '../core/keyboardNavigation'
import { BodyCell } from './BodyCell'
import { ColumnWindowContext } from './columnWindow'
import { VirtualCenterSpacer } from './VirtualCenterSpacer'
import { rowHasWave } from '../core/headerActions/actionStatus'
import type { ActionStatus } from '../core/headerActions/actionStatusFeature'
import { RightFillerBodyColumn } from './RightFillerBodyColumn'
import { needsRightFiller } from './layout'
import { usePredicateResult } from '../core/renderVersion'

import styles from '../grid/BodyRow/BodyRow.module.css'

export interface TableBodyRowProps {
  layout: 'grid' | 'flex'
  /**
   * Липкая копия строки группы под шапкой (ADR 0160, §3): без клавиатурной навигации и
   * `aria-*` строки; `stickyLast` — нижняя в стопке, под ней отделитель; `stickyPushed` —
   * группа кончилась, следующая выталкивает копию: она уходит как обычная строка.
   */
  copy?: boolean
  stickyLast?: boolean
  stickyPushed?: boolean
  row: Row<any, any>
  visibleCells: Cell<any, any, unknown>[]
  virtualRow: VirtualItem
  /** Окно колонок; в теле его даёт `ColumnWindowContext`, чтобы сдвиг не перерисовывал строку. */
  virtualColumns?: VirtualItem[]
  leafColumns: Column<any, any, unknown>[]
  leftCellSlot?: CellSlot
  rightCellSlot?: CellSlot
  cellSlot?: CellSlot
  actionRowSlot?: CellSlot
  /** `aria-rowindex` первой строки тела минус 1: строки шапки + строки прошлых страниц. */
  ariaRowIndexBase: number
  /** Позиция строки среди соседей в treegrid; есть только в treegrid. */
  treeSetSize?: number
  treePosInSet?: number
  /** Данные строки окна от плагинов — линии дерева (ADR 0170, §3). */
  window?: WindowRow
  /** Строка — слот перетаскивания: скелет на этой глубине (ADR 0108). */
  slotDepth?: number
  /** Будущий родитель слота перетаскивания (ADR 0109, §4). */
  dropParent?: boolean
  isVirtualColumns: boolean
  /** Привязка к перетаскиванию от декоратора плагина (ADR 0168, §2). */
  drag?: RowDragBinding
}

interface BodyRowCellsProps extends TableBodyRowProps {
  /** Строка — цель ждущего действия с волной. */
  rowWave?: boolean
  isRowInteract: boolean
}

/**
 * Пер-строчная подписка на СВОИ срезы: строка ре-рендерится только когда меняется её
 * собственный выбор/раскрытие (а не любой выбор/раскрытие в таблице), группировка или
 * вклад плагинов в неё (ADR 0170, §3).
 */
/** Срезы, которые читает выбор строки (ADR 0195, §1); прочие её не будят. */
const ROW_SLICES = [
  'rowSelection',
  'expanded',
  'grouping',
  'rowExpandPending',
  'rowMoves',
  'highlights',
  'flashes',
  'actionStatus',
]

const useRowStateSubscription = (
  row: Row<any, any>,
  context: RowContributionContext,
) => {
  const highlightKey = rowHighlightKey(row.id)
  return useContributionNode(
    context.table,
    bodyOf(context.table).row,
    context,
    ROW_SLICES,
    (state: unknown) => {
      const s = state as {
        rowSelection?: Record<string, boolean>
        expanded?: true | Record<string, boolean>
        grouping?: unknown
        rowExpandPending?: Record<string, number>
        rowMoves?: Record<string, { pending: boolean }>
        highlights?: Highlights
        flashes?: Flashes
        actionStatus?: ActionStatus
      }
      const move = s.rowMoves?.[row.id]
      return {
        rowWave: rowHasWave(s.actionStatus, row.id),
        // У строки с потомками (группа, каскад) выбор выводится из них — своего ключа в срезе нет.
        selected: row.subRows.length
          ? (row.getIsSelected?.() ?? false)
          : (s.rowSelection?.[row.id] ?? false),
        expanded: isRowExpandedIn(s.expanded, row.id),
        grouping: s.grouping,
        expandPending: s.rowExpandPending?.[row.id] ?? 0,
        highlight: s.highlights?.[highlightKey],
        flash: s.flashes?.[highlightKey],
        // Перенос не завершён (ADR 0112): ждёт промиса или ответа цели.
        moving: !!move,
        movePending: !!move?.pending,
      } as {
        highlight?: HighlightTargetState
        flash?: FlashEntry
        moving: boolean
        movePending: boolean
        rowWave: boolean
      }
    },
  )
}

export const BodyRowCells = ({
  layout,
  row,
  virtualRow,
  visibleCells,
  virtualColumns: virtualColumnsProp,
  leafColumns,
  leftCellSlot,
  rightCellSlot,
  cellSlot,
  actionRowSlot,
  window,
  slotDepth,
  isVirtualColumns,
  isRowInteract,
  copy,
  rowWave,
}: BodyRowCellsProps) => {
  const virtualColumns =
    useContext(ColumnWindowContext) ?? virtualColumnsProp ?? []
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
      window,
      slotDepth,
      absoluteLeft,
      copy,
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

    // Один массив с ключами: при закреплении ячейка переезжает, а не монтируется заново.
    return (
      <>
        <VirtualCenterSpacer />
        {[
          ...startCells.map(cell => (
            <BodyCell key={cell.id} {...cellProps(cell)} />
          )),
          ...centerCells.map(({ cell, start }) => (
            <BodyCell key={cell.id} {...cellProps(cell, start)} />
          )),
          ...endCells.map(cell => (
            <BodyCell key={cell.id} {...cellProps(cell)} />
          )),
        ]}
        {/* Ячейки вне потока: свободное место занимает заполнитель только под волной. */}
        {rowWave && needsRightFiller(row.getVisibleCells().at(-1)?.column) && (
          <RightFillerBodyColumn wave order={2} />
        )}
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
            window={window}
            slotDepth={slotDepth}
            copy={copy}
          />
        )
      })}
      {needsRightFiller(row.getVisibleCells().at(-1)?.column) && (
        <RightFillerBodyColumn
          hasBorderTop={!row.getIsFirstRow()}
          hasBorderRight
          wave={rowWave}
        />
      )}
    </>
  )
}

/**
 * Ряд тела без Drag&Drop-обвязки. Используется, когда перетаскивание строк
 * выключено — чтобы не платить за useSortable на каждый смонтированный ряд.
 */
export const BodyRow = memo((props: TableBodyRowProps) => {
  const { layout, row, virtualRow, ariaRowIndexBase, drag } = props

  const table = (row as unknown as { table: RowContributionContext['table'] })
    .table
  const navigation = useContext(KeyboardNavigationContext)
  const contributionContext: RowContributionContext = {
    table,
    row,
    rowIndex: virtualRow.index,
    navigation: navigation && !props.copy,
    window: props.window,
  }
  const { highlight, flash, rowWave, contributions } = useRowStateSubscription(
    row,
    contributionContext,
  )
  // Вклад плагинов в строку (ADR 0170, §3): `aria-selected` выбора строк и прочее.
  const contributed = mergeContributions(
    bodyOf(table).row,
    contributions,
    contributionContext,
  )
  // Строка до сохранения: новая или удалённая черновиком (ADR 0178, §7).
  const draftMark = useRowDraftMark(table, row.id)
  const highlighted = highlightRender([{ layer: 'row', state: highlight }])
  const flashed = flashRender([{ layer: 'row', entry: flash }])
  const navRow = useKeyboardNavigationRow(
    (row as unknown as { table: unknown }).table,
    virtualRow.index,
  )
  const nav = props.copy ? undefined : navRow

  // Раскрываемость — по ответу `hasChildren` (ADR 0193).
  const canExpand = usePredicateResult(() => row.getCanExpand?.() ?? false)
  // Состояние раскрытия строки озвучивается, только если его можно менять (ADR 0119).
  const canToggle =
    canExpand && hasExpandToggle((row as { table: unknown }).table)
  const isExpanded = row.getIsExpanded?.() ?? false
  // Раскрытие ждёт промиса onExpandRow (ADR 0041, §3).
  const isExpandPending =
    (row as { getIsExpandPending?: () => boolean }).getIsExpandPending?.() ??
    false

  const rowStyles = useMemo(
    () => ({ top: virtualRow.start }),
    [virtualRow.start],
  )

  // Слот — по сессии перетаскивания строки (ADR 0168, DM8); при декораторе — по dnd-kit: в
  // React 18 её старт коммитится позже атома перетаскивания.
  const slotDepth = drag && !drag.dragging ? undefined : props.slotDepth
  const interacting = drag ? drag.interacting : true

  return (
    <div
      {...contributed.attrs}
      {...(drag && {
        ref: (element: HTMLDivElement | null) => {
          drag.setNodeRef(element)
          assignRef(nav?.ref, element)
        },
      })}
      {...(nav && {
        ...(!drag && { ref: nav.ref }),
        tabIndex: nav.tabIndex,
        onFocus: nav.onFocus,
        onBlur: nav.onBlur,
        [NAV_ROW_ATTR]: '',
      })}
      data-kn-active={nav?.isActive || undefined}
      className={clsx('data-grid__body-row', styles.body__row)}
      role="row"
      aria-rowindex={ariaRowIndexBase + virtualRow.index + 1}
      // aria-expanded строки допустим только в treegrid; в table состояние несёт
      // кнопка раскрытия (ADR 0015, RE10, RE12).
      aria-expanded={
        canToggle && props.treeSetSize !== undefined ? isExpanded : undefined
      }
      aria-busy={isExpandPending || drag?.busy || undefined}
      aria-level={props.treeSetSize !== undefined ? row.depth + 1 : undefined}
      aria-setsize={props.treeSetSize}
      aria-posinset={props.treePosInSet}
      data-index={virtualRow.index}
      data-row-id={row.id}
      data-sticky-copy={props.copy || undefined}
      data-sticky-last={props.stickyLast || undefined}
      data-sticky-pushed={props.stickyPushed || undefined}
      data-selected={row.getIsSelected?.() ?? false}
      data-expanded={canExpand ? isExpanded : undefined}
      data-group-row={row.getIsGrouped?.() ?? false}
      data-row-draft={draftMark}
      {...highlighted.attrs}
      {...flashed.attrs}
      data-row-odd={virtualRow.index % 2 !== 0}
      data-row-draggable={drag?.dragging}
      data-row-slot-hidden={drag?.slotHidden || undefined}
      data-row-drop-parent={props.dropParent || undefined}
      data-row-interact={interacting}
      data-last-row={row.getIsLastRow()}
      data-layout={layout}
      style={
        highlighted.style || flashed.style || contributed.style
          ? {
              ...rowStyles,
              ...contributed.style,
              ...highlighted.style,
              ...flashed.style,
            }
          : rowStyles
      }
    >
      <BodyRowCells
        {...props}
        slotDepth={slotDepth}
        isRowInteract={interacting}
        rowWave={rowWave}
      />
    </div>
  )
})

BodyRow.displayName = 'BodyRow'
