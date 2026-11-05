import type {
  DragAbortEvent,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'

import type { Row, Table } from '../../types'
import {
  holdSessionHooks,
  releaseSessionHooks,
  takeDragCancelReason,
  type SessionCancelReason,
} from '../../core/cancelInteraction'
import {
  getDepthFromOffsetLeft,
  getAllowedDepth,
  getDragSourceParams,
  getMaxDepth,
  getMinDepth,
  getOffsetLeftFromDepth,
  getTargetParentId,
  getValidDepth,
} from './draggingHelpers'
import {
  childrenOf,
  hasLazyMoves,
  readRowMoves,
  rowIdOf,
} from '../../shared/rowMoves'
import { commitRowMove } from './commitRowMove'
import { commitGroupMove, isClientGrouped } from './groupMove'
import { reportAction } from '../../core/debugActions'
import { inOneCommit } from '../../util/oneCommit'
import { findDropParent, indexBeforeMove } from '../../core/dragSession'
import { dragRowsOf } from './dragRows'
import { dropPlace } from './dropPlace'
import { rowSourceOf } from '../../core/rowSource'
import { commitServerMove, type ServerMovePlace } from './serverMove'
import type { ExpandTimer } from './expandTimer'
import { getRowDraggableOffsetLeft } from './getRowDraggableOffsetLeft'
import { reorderRows } from './reorderRows'
import { canMoveInLazyTree, warnLazyTree } from './rowDraggingFeature'
import {
  DEFAULT_ROW_DRAG_OVERLAY_STATE,
  type RowDraggingHooks,
  type RowDragOverlayState,
  type RowSortableData,
} from './types'

/**
 * Редьюсер DnD-событий тела: переупорядочивание строк c поддержкой вложенности
 * (root↔группа, группа↔группа), временного сворачивания перетаскиваемой группы и
 * ограничения глубины. Читает снимок overlay-состояния из атома `rowDragging` и
 * пишет через опции rowDragging/rowExpanding.
 */
/** Дробная погрешность замера: текст облака ровно на отступе — уже этот уровень. */
const LEVEL_EPSILON = 0.01

/** Пауза над свёрнутой группой по умолчанию, мс (ADR 0109, §1). */
export const DEFAULT_ROW_DRAG_EXPAND_DELAY = 500

export interface RowDraggingGeometry {
  /**
   * Дробный уровень броска под текстом облака при сдвиге `deltaX` (ADR 0108, §2);
   * `undefined` — геометрия не измерена, уровень — по шагу перетаскивания.
   */
  levelAt?: (deltaX: number) => number | undefined
  /** Пауза над свёрнутой группой; живёт дольше обработчиков одного рендера. */
  expandTimer?: ExpandTimer
}

type ExpandableRow = Row<any, any> & {
  setExpandedByUser?: (expanded: boolean) => void
  getIsLazyParent?: () => boolean
}

/** Дети строки — ответ `loadChildren` (ADR 0112, §2). */
export const isLazyParent = (row: Row<any, any> | undefined) =>
  !!(row as ExpandableRow | undefined)?.getIsLazyParent?.()

/** Раскрыть путём клика (rowExpanding), без него — напрямую. */
const setExpandedByUser = (row: Row<any, any>, expanded: boolean) => {
  const r = row as ExpandableRow
  if (r.setExpandedByUser) r.setExpandedByUser(expanded)
  else if (row.getIsExpanded() !== expanded) row.toggleExpanded(expanded)
}

const isDefaultDragState = (state: RowDragOverlayState) =>
  (
    Object.keys(DEFAULT_ROW_DRAG_OVERLAY_STATE) as (keyof RowDragOverlayState)[]
  ).every(key =>
    key === 'openedByDelay'
      ? state.openedByDelay.length === 0
      : state[key] === DEFAULT_ROW_DRAG_OVERLAY_STATE[key],
  )

export const getRowDraggingEvents = (
  table: Table<any, any>,
  { levelAt, expandTimer }: RowDraggingGeometry = {},
): {
  onRowModelChange: () => void
  onRowDragStart?: (event: DragStartEvent) => void
  onRowDragMove?: (event: DragMoveEvent) => void
  onRowDragEnd?: (event: DragEndEvent) => void
  onRowDragCancel?: (event: DragCancelEvent) => void
  onRowDragAbort?: (event: DragAbortEvent) => void
} => {
  const rows = dragRowsOf(table)

  const rowDraggingState = (
    table as unknown as {
      atoms: { rowDragging: { get: () => RowDragOverlayState } }
    }
  ).atoms.rowDragging.get()

  // v9 useTable возвращает фасад с сырыми options (без фичевых defaults), поэтому
  // overlay-состояние меняем методом table.setRowDragging (бьёт по внутреннему
  // updater), а не через table.options.onRowDraggingChange. onRowOrderChange передаёт
  // потребитель — он на возвращаемых options есть.
  const onRowDraggingChange = (
    table as unknown as {
      setRowDragging: (
        updater: (prev: RowDragOverlayState) => RowDragOverlayState,
      ) => void
    }
  ).setRowDragging
  const { onRowOrderChange } = table.options

  /** Все группы раскрыты — записью, чтобы сменить одну (ADR 0137, §6). */
  const allExpanded = () =>
    Object.fromEntries(
      table
        .getCoreRowModel()
        .flatRows.filter(row => row.getCanExpand())
        .map(row => [row.id, true]),
    )

  /** Свернуть/развернуть группу до и после перетаскивания. */
  const expandGroup = (groupId: UniqueIdentifier, expanded: boolean) => {
    table.setExpanded?.(prev => ({
      ...(prev === true ? allExpanded() : prev),
      [groupId]: expanded,
    }))
  }

  /** Непустая перетаскиваемая группа временно сворачивается. */
  const collapseDraggableGroup = (row: Row<any, any>) => {
    if (row.subRows.length > 0) {
      expandGroup(row.id, false)
    }
  }

  /** Развернуть группу после перетаскивания, если до него она была развёрнута. */
  const expandDraggableGroupAgain = (row: Row<any, any>) => {
    if (row.subRows.length > 0 && rowDraggingState.isExpanded) {
      expandGroup(row.id, true)
    }
  }

  /**
   * Целевой элемент при движении вверх/вниз. Он не всегда равен элементу под
   * курсором — выбираем его исходя из направления движения.
   */
  const getTargetItems = (
    activeVirtualIndex: number,
    overVirtualIndex: number,
  ) => {
    const isDownMove = activeVirtualIndex < overVirtualIndex

    const overItem = rows.at(overVirtualIndex)
    const prevItem = rows.at(overVirtualIndex - 1)
    const nextItem = rows.at(overVirtualIndex + 1)
    const targetItem = (isDownMove ? overItem : prevItem) as
      Row<any, any> | undefined

    return { targetItem, prevItem, nextItem, isDownMove }
  }

  const resetDragState = () => {
    expandTimer?.clear()
    document.body.style.cursor = 'default'
    // Нажатие без сдвига застаёт состояние по умолчанию — store не трогаем (D39).
    onRowDraggingChange?.(prev =>
      isDefaultDragState(prev) ? prev : DEFAULT_ROW_DRAG_OVERLAY_STATE,
    )
  }

  const rowById = (id: string): Row<any, any> | undefined => rows.byId(id)

  /** Группа раскрыта паузой: запомнить, чтобы свернуть после сессии (ADR 0109, §3). */
  const openByDelay = (group: Row<any, any>) => {
    reportAction(table, {
      plugin: 'rowDragging',
      action: 'expandOnHover',
      detail: { rowId: group.id },
      source: 'pointer',
    })
    // Отметка и раскрытие — одним коммитом: свёрнутая отмеченная группа — отказ загрузки.
    inOneCommit(() => {
      onRowDraggingChange(prev =>
        prev.activeId === null
          ? prev
          : { ...prev, openedByDelay: [...prev.openedByDelay, group.id] },
      )
      setExpandedByUser(group, true)
    })
  }

  /** Свернуть группы, раскрытые паузой, кроме `keep`. */
  const collapseOpenedByDelay = (keep: ReadonlySet<string> = new Set()) => {
    for (const id of rowDraggingState.openedByDelay) {
      const row = rowById(id)
      if (row && !keep.has(id)) setExpandedByUser(row, false)
    }
  }

  /** Строка `id` и её предки. */
  const lineageOf = (id: string | undefined) => {
    const ids = new Set<string>()
    for (
      let row = id === undefined ? undefined : rowById(id);
      row;
      row = row.getParentRow()
    ) {
      ids.add(row.id)
    }
    return ids
  }

  /** Сессия кончилась без перестановки (ADR 0040, §1). */
  const cancel = (rowId: UniqueIdentifier, reason: SessionCancelReason) => {
    reportAction(table, {
      plugin: 'rowDragging',
      action: 'dragCancel',
      detail: { rowId: String(rowId), reason },
      source: 'pointer',
      phase: 'end',
    })
    collapseOpenedByDelay()
    resetDragState()
    releaseSessionHooks<Partial<RowDraggingHooks>>(
      table as never,
      'rowDragging',
    ).onRowDragCancel?.({ rowId: String(rowId), reason })
  }

  /**
   * Группа, раскрытая паузой, свернулась посреди сессии — загрузка её детей упала: в
   * неё не вкладывают (ADR 0112, §4).
   */
  const closedAfterDelay = (row: Row<any, any> | undefined) =>
    !!row &&
    rowDraggingState.openedByDelay.includes(row.id) &&
    !row.getIsExpanded()

  /** Ленивый перенос без `onRowDragEnd` недопустим (ADR 0112, §2). */
  const lazyBlocked = (
    activeRow: Row<any, any>,
    from: number,
    to: number,
    depth: number,
  ) =>
    // Без rowExpanding ленивых родителей нет; ветки серверной модели — не стадия модели.
    !rows.server &&
    !!(activeRow as ExpandableRow).getIsLazyParent &&
    !canMoveInLazyTree(table) &&
    (isLazyParent(activeRow.getParentRow()) ||
      isLazyParent(rows.at(findDropParent(rows, { from, to, depth }, 0))))

  const grouped = () =>
    ((table.atoms as { grouping?: { get: () => unknown[] } }).grouping?.get()
      .length ?? 0) > 0

  /** Клиентская группа: перестановки внутри неё нет (ADR 0186, §4). */
  const inOwnGroup = (
    activeRow: Row<any, any>,
    from: number,
    to: number,
    depth: number,
  ) =>
    isClientGrouped(table) &&
    from !== to &&
    dropPlace(rows, activeRow, { from, to, depth }).parent?.id ===
      activeRow.parentId

  /**
   * Место броска в серверной модели (ADR 0159, §4): ветка раскрыта, её строки пришли, сестра
   * рядом видна; иначе `undefined`.
   */
  const serverPlace = (
    activeRow: Row<any, any>,
    from: number,
    to: number,
    depth: number,
  ): ServerMovePlace | undefined => {
    const place = dropPlace(rows, activeRow, { from, to, depth })
    if (place.index < 0 || (depth > 0 && !place.parent)) return undefined
    const parentId = place.parent?.id
    return rowSourceOf(table).branchSize?.(parentId)
      ? { parentId, index: place.index }
      : undefined
  }

  // Шаг уровня читается из темы на старте перетаскивания, а не в рендере (RE64):
  // обработчики, пересозданные посреди перетаскивания, читают его при первом событии.
  let levelStep: number | undefined
  const getLevelStep = () =>
    (levelStep ??= getRowDraggableOffsetLeft({ table }))

  return {
    // Строки сменились без движения указателя: слот над свернувшейся группой уходит на
    // её уровень в том же кадре.
    onRowModelChange: () => {
      const { activeId, fromIndex, overIndex, depth } = rowDraggingState
      if (activeId === null || fromIndex === null || overIndex === null) return
      // Строки ветки пришли без движения указателя — место становится допустимым.
      if (rowDraggingState.waitsForBranch) {
        const active = rows.byId(String(activeId))
        if (active && serverPlace(active, fromIndex, overIndex, depth)) {
          onRowDraggingChange(prev => ({
            ...prev,
            acceptable: true,
            waitsForBranch: false,
          }))
        }
        return
      }
      if (!overIndex) return
      const above = rows.at(
        indexBeforeMove(overIndex - 1, fromIndex, overIndex),
      )
      if (!closedAfterDelay(above) || depth <= above!.depth) return
      onRowDraggingChange(prev => ({
        ...prev,
        depth: above!.depth,
        offsetLeft: getOffsetLeftFromDepth(above!.depth, getLevelStep()),
      }))
    },
    onRowDragStart: ({ active }) => {
      const { row, virtualIndex } = active.data.current as RowSortableData
      levelStep = getRowDraggableOffsetLeft({ table })

      document.body.style.cursor = 'grabbing'
      reportAction(table, {
        plugin: 'rowDragging',
        action: 'drag',
        detail: { rowId: row.id },
        source: 'pointer',
        phase: 'start',
      })
      holdSessionHooks(table as never, 'rowDragging')
      onRowDraggingChange(prev => ({
        ...prev,
        activeId: active.id,
        // Начальная позиция индикатора вложенности
        offsetLeft: row.getIsLastSubRow()
          ? 0
          : getOffsetLeftFromDepth(row.depth, getLevelStep()),
        // Запомнить, была ли открыта группа до перетаскивания, чтобы свернуть её на
        // время и после открыть вновь (rowExpanding может отсутствовать → false).
        isExpanded: row.getIsExpanded?.() ?? false,
        // Возможность переместить строку на данную вложенность (зависит от
        // ограничения по глубине вложенности)
        acceptable: true,
        fromIndex: virtualIndex,
        overIndex: virtualIndex,
        overId: row.id,
        depth: row.depth,
        openedByDelay: [],
      }))

      collapseDraggableGroup(row)
    },
    onRowDragMove: ({ active, over, delta }) => {
      if (!over) {
        return
      }
      // Строка под указателем не загружена: соседей не видно — бросок недоступен (ADR 0159, §3).
      if ((over.data.current as { pending?: boolean } | undefined)?.pending) {
        expandTimer?.clear()
        onRowDraggingChange?.(prev =>
          prev.acceptable ? { ...prev, acceptable: false } : prev,
        )
        return
      }
      if (over.id !== rowDraggingState.overId) {
        reportAction(table, {
          plugin: 'rowDragging',
          action: 'dragOver',
          detail: { overId: String(over.id) },
          source: 'pointer',
        })
      }

      const { virtualIndex: activeVirtualIndex, row: activeRow } =
        getDragSourceParams(active)
      const { virtualIndex: overVirtualIndex } = getDragSourceParams(over)

      const { targetItem } = getTargetItems(
        activeVirtualIndex,
        overVirtualIndex,
      )

      const level = levelAt?.(delta.x)
      // Уровень k — когда текст облака дошёл до отступа уровня k (ADR 0108, §2): под
      // текстом группы строка ещё не вложена.
      const currentDepth =
        level === undefined
          ? getDepthFromOffsetLeft(delta.x, getLevelStep())
          : Math.floor(level + LEVEL_EPSILON)

      const minDepth = getMinDepth(activeRow, targetItem, over.id)
      const maxDepth = closedAfterDelay(targetItem)
        ? targetItem!.depth
        : getMaxDepth(targetItem, table)
      const validDepth = getValidDepth(currentDepth, minDepth, maxDepth)
      const blocked = (depth: number) =>
        lazyBlocked(activeRow, activeVirtualIndex, overVirtualIndex, depth) ||
        // Группы: лист — только в группу того же уровня (ADR 0159, §5; ADR 0186, §4).
        (grouped() && depth !== activeRow.depth) ||
        inOwnGroup(activeRow, activeVirtualIndex, overVirtualIndex, depth)
      if (
        lazyBlocked(activeRow, activeVirtualIndex, overVirtualIndex, validDepth)
      ) {
        warnLazyTree(table)
      }
      // Строка с детьми в группу не вкладывается; ленивый перенос — только с колбэком.
      // Есть допустимый уровень — слот на нём, нет — место недопустимо (ADR 0137, §3).
      const withChildren = activeRow.getCanExpand?.() ?? false
      const allowedDepth = getAllowedDepth(
        validDepth,
        minDepth,
        maxDepth,
        depth => (!withChildren || depth === 0) && !blocked(depth),
      )
      const acceptable = allowedDepth !== undefined
      const depth = allowedDepth ?? validDepth

      // Слот вкладывают в свёрнутую группу — пауза раскрывает её (ADR 0109, §1).
      const delay =
        table.options.rowDragExpandDelay ?? DEFAULT_ROW_DRAG_EXPAND_DELAY
      const group =
        acceptable &&
        delay > 0 &&
        targetItem &&
        targetItem.id !== activeRow.id &&
        depth === targetItem.depth + 1 &&
        (targetItem.getCanExpand?.() ?? false) &&
        !targetItem.getIsExpanded() &&
        // Не раскрылась (отказ загрузки) — не повторять в этой сессии.
        !rowDraggingState.openedByDelay.includes(targetItem.id)
          ? targetItem
          : undefined
      if (group) expandTimer?.arm(group.id, delay, () => openByDelay(group))
      else expandTimer?.clear()

      // Ветка серверной модели свёрнута или её строк ещё нет — бросок после их прихода.
      const waitsForBranch =
        acceptable &&
        rows.server &&
        !serverPlace(activeRow, activeVirtualIndex, overVirtualIndex, depth)

      onRowDraggingChange?.(prev => ({
        ...prev,
        offsetLeft: getOffsetLeftFromDepth(depth, getLevelStep()),
        acceptable: acceptable && !waitsForBranch,
        waitsForBranch,
        fromIndex: activeVirtualIndex,
        overIndex: overVirtualIndex,
        overId: String(over.id),
        depth,
      }))
    },
    onRowDragEnd: ({ active, over }) => {
      const {
        virtualIndex: activeVirtualIndex,
        row: activeRow,
        parentRow: activeParentRow,
      } = getDragSourceParams(active)

      const activeIsGroup = activeRow.subRows.length > 0

      // Бросок без перестановки (мимо, на то же место, недопустимо, на незагруженную
      // строку) — `cancel`.
      if (
        !over ||
        !rowDraggingState.acceptable ||
        (over.data.current as { pending?: boolean } | undefined)?.pending
      ) {
        expandDraggableGroupAgain(activeRow)

        return cancel(active.id, 'cancel')
      }

      const { virtualIndex: overVirtualIndex } = getDragSourceParams(over)

      const { targetItem, nextItem, isDownMove } = getTargetItems(
        activeVirtualIndex,
        overVirtualIndex,
      )

      const currentDepth = getDepthFromOffsetLeft(
        rowDraggingState.offsetLeft,
        getLevelStep(),
      )

      // Если id или вложенность не поменялась, элемент остаётся на месте
      if (active.id === over?.id && activeRow.depth === currentDepth) {
        expandDraggableGroupAgain(activeRow)

        return cancel(active.id, 'cancel')
      }

      const rowId = String(active.id)
      // Серверная модель (ADR 0159, §2, §4): строка встаёт на место слота транзакцией
      // источника — в ветку, чьи строки пришли.
      if (rows.server) {
        const place = serverPlace(
          activeRow,
          activeVirtualIndex,
          overVirtualIndex,
          currentDepth,
        )
        if (
          !place ||
          (place.parentId === activeRow.parentId &&
            place.index === activeRow.index)
        ) {
          return cancel(active.id, 'cancel')
        }
        reportAction(table, {
          plugin: 'rowDragging',
          action: 'drop',
          detail: { rowId, parentId: place.parentId, index: place.index },
          source: 'pointer',
          phase: 'end',
        })
        collapseOpenedByDelay(lineageOf(place.parentId))
        commitServerMove(
          table,
          rowId,
          { from: activeVirtualIndex, to: overVirtualIndex },
          place,
          releaseSessionHooks<Partial<RowDraggingHooks>>(
            table as never,
            'rowDragging',
          ).onRowDragEnd,
        )
        return resetDragState()
      }
      // Клиентская группировка (ADR 0186, §2): лист меняет группу, значение пишет приложение.
      if (isClientGrouped(table)) {
        const group = dropPlace(rows, activeRow, {
          from: activeVirtualIndex,
          to: overVirtualIndex,
          depth: currentDepth,
        }).parent
        if (!group || group.id === activeRow.parentId) {
          return cancel(active.id, 'cancel')
        }
        reportAction(table, {
          plugin: 'rowDragging',
          action: 'drop',
          detail: { rowId, parentId: group.id },
          source: 'pointer',
          phase: 'end',
        })
        commitGroupMove(
          table,
          activeRow,
          group,
          { from: activeVirtualIndex, to: overVirtualIndex },
          releaseSessionHooks<Partial<RowDraggingHooks>>(
            table as never,
            'rowDragging',
          ).onRowDragEnd,
        )
        if (!group.getIsExpanded()) setExpandedByUser(group, true)
        collapseOpenedByDelay(lineageOf(group.id))
        return resetDragState()
      }
      const activeParentId = activeRow.parentId
      const place = dropPlace(rows, activeRow, {
        from: activeVirtualIndex,
        to: overVirtualIndex,
        depth: currentDepth,
      })
      const lazy = isLazyParent(activeParentRow) || isLazyParent(place.parent)
      // Пока ждут ленивые переносы, индексы модели — со стадией: место — по проекции.
      const staged = lazy || hasLazyMoves(readRowMoves(table))
      const overParentId = staged
        ? place.parent?.id
        : getTargetParentId(targetItem, nextItem, currentDepth)

      // Группа не может быть помещена в другую группу
      if (activeIsGroup && !!overParentId) {
        expandDraggableGroupAgain(activeRow)

        return cancel(active.id, 'cancel')
      }
      if (
        staged &&
        place.parent?.id === activeParentId &&
        place.index === activeRow.index
      ) {
        expandDraggableGroupAgain(activeRow)

        return cancel(active.id, 'cancel')
      }

      const { onRowDragEnd } = releaseSessionHooks<Partial<RowDraggingHooks>>(
        table as never,
        'rowDragging',
      )
      const common = {
        rowId,
        dragIndex: activeVirtualIndex,
        hoverIndex: overVirtualIndex,
        parentId: overParentId,
        previousParentId: activeParentId,
        original: activeRow.original,
        anchors: (place.parent?.subRows ?? table.getCoreRowModel().rows)
          .map(row => row.id)
          .filter(id => id !== rowId),
        fromAnchors: (activeParentRow?.subRows ?? table.getCoreRowModel().rows)
          .map(row => row.id)
          .filter(id => id !== rowId),
        fromIndex: activeRow.index,
      }
      reportAction(table, {
        plugin: 'rowDragging',
        action: 'drop',
        detail: { rowId, parentId: overParentId, index: place.index },
        source: 'pointer',
        phase: 'end',
      })
      if (lazy) {
        commitRowMove(
          table,
          {
            ...common,
            index: place.index,
            lazy: {
              original: activeRow.original,
              from: {
                parentId: activeParentId,
                index: activeRow.index,
                lazy: isLazyParent(activeParentRow),
              },
              to: {
                parentId: overParentId,
                index: place.index,
                lazy: isLazyParent(place.parent),
                anchors: common.anchors,
              },
            },
          },
          onRowDragEnd,
        )
      } else {
        const move = {
          activeParentId,
          overParentId,
          activeParentRow,
          activeOriginalIndex: activeRow.index,
          overOriginalIndex: targetItem?.index || 0,
          targetItem,
          isDownMove,
          currentDepth,
        }
        // Место после переноса — по тому же переносу на снимке данных.
        const idOf = rowIdOf(table)
        const index = staged
          ? place.index
          : (childrenOf(
              reorderRows([...(table.options.data as any[])], move),
              overParentId,
              idOf,
            )?.findIndex((item, i) => idOf(item, i, overParentId) === rowId) ??
            0)
        commitRowMove(
          table,
          {
            ...common,
            index,
            write: () => onRowOrderChange?.(prev => reorderRows(prev, move)),
          },
          onRowDragEnd,
        )
      }

      // Бросок в свёрнутую группу раскрывает её (ADR 0109, §2); раскрытые паузой
      // сворачиваются, кроме группы броска и её предков (§3).
      const dropGroup =
        overParentId === undefined ? undefined : rowById(overParentId)
      if (dropGroup && !dropGroup.getIsExpanded()) {
        setExpandedByUser(dropGroup, true)
      }
      collapseOpenedByDelay(lineageOf(overParentId))

      expandDraggableGroupAgain(activeRow)

      return resetDragState()
    },
    // Отмена (Escape, запрет на лету, строка ушла).
    onRowDragCancel: ({ active }) => {
      const { row: activeRow } = getDragSourceParams(active)

      expandDraggableGroupAgain(activeRow)

      return cancel(active.id, takeDragCancelReason())
    },
    onRowDragAbort: resetDragState,
  }
}
