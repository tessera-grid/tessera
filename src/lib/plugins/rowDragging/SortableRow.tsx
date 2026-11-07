/**
 * Декоратор строки тела (ADR 0168, §2): регистрирует строку в `SortableContext` тела и
 * отдаёт строке привязку перетаскивания; ручке в ячейках — атрибуты dnd-kit через контекст.
 */
import { memo, useCallback, useRef } from 'react'

import { useSortable } from '@dnd-kit/sortable'

import type { RowDecoratorProps } from '../../core/pluginWrappers'
import { useTableState } from '../../core/reactivity'
import { usePredicateResult } from '../../core/renderVersion'
import { ItemSortableContextProvider } from '../../shared/dnd'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { animateLayoutChanges } from './animationHelpers'
import { useSlotGlide } from './useSlotGlide'

/** Сдвиг строки от dnd-kit; уровень слота — отступом ячейки (ADR 0108, §2). */
const transformAt = (y: number) => `translate3d(0px, ${y}px, 0px)`

export const SortableRow = memo(({ Row, ...props }: RowDecoratorProps) => {
  const { row, virtualRow } = props
  const table = (row as unknown as { table: object }).table
  // Строка перетаскивается — по ответу `canDragRow` (ADR 0193).
  const canDrag = usePredicateResult(() => row.getCanDrag())
  // Перенос не завершён (ADR 0112): ждёт промиса или ответа цели.
  const move = useTableState(
    table as never,
    (state: unknown) =>
      (state as { rowMoves?: Record<string, { pending: boolean }> }).rowMoves?.[
        row.id
      ],
  ) as { pending: boolean } | undefined

  const {
    setActivatorNodeRef,
    attributes,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    overIndex,
    over,
    isDragging,
    isSorting,
  } = useSortable({
    id: row.id,
    data: {
      type: 'row',
      virtualIndex: virtualRow.index,
      row,
      parentRow: row.getParentRow(),
    },
    // Строку с незавершённым переносом не тянут, но на неё бросают (ADR 0112).
    disabled: { draggable: !!move, droppable: false },
    animateLayoutChanges,
  })

  const interacting = overIndex === -1
  // Указатель над незагруженной строкой: слота нет, бросок недоступен (ADR 0159, §3).
  const slotHidden =
    isDragging &&
    !!(over?.data.current as { pending?: boolean } | undefined)?.pending
  const node = useRef<HTMLElement | null>(null)
  // dnd-kit гасит сдвиги на рендер, в котором сменились строки окна (группа раскрылась
  // посреди сессии): строка держит прежний сдвиг, иначе соседи на кадр встают на места
  // раскладки и едут обратно (ADR 0109). `undefined` — держать.
  const shift = transform?.y ?? (isSorting && !interacting ? undefined : 0)
  useSlotGlide(node, shift, isDragging, transformAt)
  useIsomorphicLayoutEffect(() => {
    if (shift !== undefined && node.current) {
      node.current.style.transform = transformAt(shift)
    }
  }, [shift])

  const setNodeRef = useCallback(
    (element: HTMLElement | null) => {
      node.current = element
      setDraggableNodeRef(element)
      setDroppableNodeRef(element)
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  )

  const rowElement = (
    <Row
      {...props}
      drag={{
        setNodeRef,
        dragging: isDragging,
        slotHidden,
        interacting,
        busy: !!move?.pending,
      }}
    />
  )
  return canDrag ? (
    <ItemSortableContextProvider
      setActivatorNodeRef={setActivatorNodeRef}
      listeners={listeners}
      attributes={attributes}
    >
      {rowElement}
    </ItemSortableContextProvider>
  ) : (
    rowElement
  )
})

SortableRow.displayName = 'SortableRow'
