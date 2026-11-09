// Обёртка тела плагина rowDragging (ADR 0168, §2): DndContext + SortableContext строк —
// только при включённом перетаскивании или идущей сессии. Состояние облака — срез
// rowDragging, геометрия переупорядочивания — getRowDraggingEvents, облако рисует грид.
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  DndContext,
  type DragMoveEvent,
  type DragStartEvent,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'

import { cancelDragLikeEscape } from '../../core/cancelInteraction'
import type { BodyBoundaryProps } from '../../core/pluginWrappers'
import { useSlice, useTableState } from '../../core/reactivity'
import { getRowDraggingEvents } from './getRowDraggingEvents'
import type { RowDragOverlayState } from './types'
import { createExpandTimer } from './expandTimer'
import { dragRowsOf } from './dragRows'
import { readRowNestingIndent } from '../../core/rowNesting'
import { createDropLevel } from './dropLevel'
import {
  Z_INDEX,
  adjustOverlayPosition,
  autoScrollOnlyY,
  dndAccessibility,
  measuring,
  sensorOptions,
} from '../../shared/dnd/parameters'
import { DragHandler } from '../../shared/dnd'
import { windowedListSortingStrategy } from './windowedListSortingStrategy'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { useLatest } from '../../util/useLatest'
import { usePredicateResult } from '../../core/renderVersion'
import { REACT_MAJOR } from '../../util/reactVersion'
import { rowsOf } from '../../core/rowEngine/rows'

/** Перетаскиваемая строка модели; без перетаскивания строки не обходятся (D33). */
export const findDraggableRow = <TRow,>(
  rows: { byId: (id: string) => TRow | undefined },
  activeId: string | null | undefined,
): TRow | undefined => (activeId == null ? undefined : rows.byId(activeId))

/**
 * id строк для `SortableContext` тела — только строки окна виртуализатора (D34):
 * индексы и смещения dnd-kit нужны смонтированным строкам, перестановка считается
 * по `virtualIndex` из данных строки.
 */
export const getSortableRowIds = (
  rows: { at: (index: number) => { id: string } | undefined },
  virtualRows: readonly { index: number }[],
): string[] =>
  // Незагруженная строка серверной модели — не место броска (ADR 0159, §3).
  virtualRows.flatMap(virtualRow => {
    const row = rows.at(virtualRow.index)
    return row ? [row.id] : []
  })

/**
 * Смена места броска — в коммите `over` dnd-kit (ADR 0108, PV5). React 18 коммитит
 * атом перетаскивания раньше состояния dnd-kit: линии кадр опережали бы сдвиги строк.
 */
const OverCommit = ({
  pendingRef,
  applyRef,
}: {
  pendingRef: RefObject<DragMoveEvent | null>
  applyRef: RefObject<(event: DragMoveEvent) => void>
}) => {
  const { over } = useDndContext()
  useIsomorphicLayoutEffect(() => {
    const event = pendingRef.current
    if (!event) return
    pendingRef.current = null
    applyRef.current(event)
  }, [over, pendingRef, applyRef])
  return null
}

const NO_SORTABLE_ROWS: string[] = []

/** Монтирует Drag&Drop-обвязку тела только при включённом перетаскивании строк. */
export const BodyBoundary = ({
  table,
  virtualRows,
  renderCloud,
  children,
}: BodyBoundaryProps) => {
  // Идущее перетаскивание держит обёртку, пока его не отменят (ADR 0039, RX14).
  const activeId = useTableState(
    table,
    state =>
      (state as { rowDragging?: { activeId: string | null } }).rowDragging
        ?.activeId ?? null,
  )
  if (!table.options.enableRowDragging && !activeId) {
    return children
  }

  return (
    <DndBodyWrapper
      table={table}
      virtualRows={virtualRows}
      renderCloud={renderCloud}
    >
      {children}
    </DndBodyWrapper>
  )
}

const DndBodyWrapper = ({
  table,
  virtualRows,
  renderCloud,
  children,
}: BodyBoundaryProps) => {
  // Уровень броска — по тексту облака (ADR 0108, §2): начало уровней строки меряется на
  // старте, отступ текста облака — по нему самому.
  const [dropLevel] = useState(createDropLevel)
  const attachOverlay = useCallback(
    (node: HTMLDivElement | null) => dropLevel.setOverlay(node),
    [dropLevel],
  )
  // Пауза над свёрнутой группой переживает перерисовки сессии (ADR 0109, §1).
  const [expandTimer] = useState(createExpandTimer)
  useEffect(() => expandTimer.clear, [expandTimer])
  const {
    onRowModelChange,
    onRowDragStart,
    onRowDragMove,
    onRowDragEnd,
    onRowDragCancel,
    onRowDragAbort,
  } = getRowDraggingEvents(table, {
    levelAt: dropLevel.levelAt,
    expandTimer,
  })
  const rowModelChange = useLatest(onRowModelChange)
  const dragMove = useLatest(onRowDragMove ?? (() => {}))
  const pendingOver = useRef<DragMoveEvent | null>(null)
  const deferOver = REACT_MAJOR < 19
  const startDrag = (event: DragStartEvent) => {
    const { row } = event.active.data.current as { row: { depth: number } }
    dropLevel.start(
      (event.activatorEvent?.target as Element | null)?.closest?.(
        '.data-grid__body-row',
      ),
      row.depth,
      readRowNestingIndent(table),
    )
    onRowDragStart?.(event)
  }

  const rowDragging = useSlice(
    table,
    'rowDragging' as never,
  ) as RowDragOverlayState

  // Строки по индексу окна: модель TanStack или источник серверной модели (ADR 0159).
  const modelRows = rowsOf(table, 'shown').rows as Parameters<
    typeof dragRowsOf
  >[1]
  // Серверная модель меняет строки без новой модели и без новой ссылки `table` (ADR 0196):
  // приход ветки посреди сессии виден по номеру раскладки источника.
  const listVersion = (
    table as { getRowSource?: () => { version?: () => number } }
  )
    .getRowSource?.()
    ?.version?.()
  const rows = useMemo(
    () => dragRowsOf(table, modelRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- номер раскладки — признак смены строк источника
    [table, modelRows, listVersion],
  )

  // Группа раскрылась посреди сессии — индексы места сдвинулись без движения
  // указателя: выровнять их по id до кадра (ADR 0109, §1).
  useIsomorphicLayoutEffect(() => {
    const { activeId, fromIndex, overIndex, overId } = rowDragging
    if (activeId === null || fromIndex === null || overIndex === null) return
    const staleFrom = rows.at(fromIndex)?.id !== activeId
    const staleOver = overId !== null && rows.at(overIndex)?.id !== overId
    // Индексы выровнены — слот над свернувшейся группой уходит на её уровень.
    if (!staleFrom && !staleOver) return rowModelChange.current()
    const indexOf = (id: string, at: number) =>
      rows.at(at)?.id === id ? at : rows.indexOf(id)
    const from = indexOf(String(activeId), fromIndex)
    const over = overId === null ? overIndex : indexOf(overId, overIndex)
    if (from < 0 || over < 0) return
    ;(
      table as unknown as {
        setRowDragging: (
          updater: (prev: RowDragOverlayState) => RowDragOverlayState,
        ) => void
      }
    ).setRowDragging(prev => ({ ...prev, fromIndex: from, overIndex: over }))
  }, [rows, rowDragging, table, rowModelChange])

  const activeId =
    rowDragging.activeId === null ? null : String(rowDragging.activeId)
  const draggableRow = useMemo(
    () => findDraggableRow(rows, activeId),
    [activeId, rows],
  )

  // Ответ `canDragRow` у взятой строки — по новой версии предикатов тоже (ADR 0193).
  const canDragActive = usePredicateResult(
    () =>
      !!(
        draggableRow as { getCanDrag?: () => boolean } | undefined
      )?.getCanDrag?.(),
  )
  // Перетаскивание запретили на лету или строка ушла — отмена как по Escape.
  const forbidden =
    !!activeId && (!table.options.enableRowDragging || !canDragActive)
  const lost = !draggableRow
  useIsomorphicLayoutEffect(() => {
    if (forbidden) {
      cancelDragLikeEscape(lost ? 'unavailable' : 'revoke')
    }
  }, [forbidden, lost])

  // Вне перетаскивания список строк постоянный: сдвиг окна не перерисовывает строки через
  // контекст dnd-kit (ADR 0149, PS11). Строки окна нужны только идущему перетаскиванию (D34).
  // Строки серверной модели приходят без смены раскладки: id окна — на каждый рендер сессии.
  const items =
    activeId === null ? NO_SORTABLE_ROWS : getSortableRowIds(rows, virtualRows)

  const sensors = useSensors(
    useSensor(PointerSensor, sensorOptions),
    useSensor(MouseSensor, sensorOptions),
    useSensor(TouchSensor, sensorOptions),
  )

  return (
    <DndContext
      id="data-grid-dnd-rows"
      accessibility={dndAccessibility}
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      autoScroll={autoScrollOnlyY}
      onDragStart={startDrag}
      onDragMove={event => {
        // Отложенная смена места применится с последним сдвигом указателя.
        if (pendingOver.current) {
          pendingOver.current = { ...pendingOver.current, delta: event.delta }
        }
        onRowDragMove?.(event)
      }}
      // Смена места без движения указателя (автопрокрутка, сдвиг соседей) — то же
      // превью броска (ADR 0108, PV5).
      onDragOver={
        deferOver
          ? (event: DragMoveEvent) => (pendingOver.current = event)
          : onRowDragMove
      }
      // Отпустили до коммита смены места — бросок по видимому превью, как у dnd-kit.
      onDragEnd={event => {
        pendingOver.current = null
        onRowDragEnd?.(event)
      }}
      onDragCancel={event => {
        pendingOver.current = null
        onRowDragCancel?.(event)
      }}
      onDragAbort={event => {
        pendingOver.current = null
        onRowDragAbort?.(event)
      }}
    >
      {deferOver && <OverCommit pendingRef={pendingOver} applyRef={dragMove} />}
      <SortableContext
        id="data-grid-sortable-rows"
        items={items}
        strategy={windowedListSortingStrategy}
      >
        {children}
      </SortableContext>
      <DragOverlay
        modifiers={[adjustOverlayPosition]}
        // Облако пропадает при отпускании, строка вспыхивает на месте (ADR 0110).
        dropAnimation={null}
        zIndex={Z_INDEX}
      >
        {draggableRow &&
          renderCloud(draggableRow as never, {
            ref: attachOverlay,
            handle: <DragHandler id="" type="row" />,
          })}
      </DragOverlay>
    </DndContext>
  )
}
