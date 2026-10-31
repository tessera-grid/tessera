/**
 * Декоратор ячейки шапки (ADR 0168, §2): регистрирует узел (лист или группу) в
 * `SortableContext` его соседей; для закреплённых и служебных сортировка отключена через
 * `disabled`. Ячейки под группой сдвигаются и скрываются вместе с ней (ND4).
 */
import { memo, useContext, useMemo, useSyncExternalStore } from 'react'

import { useSortable } from '@dnd-kit/sortable'

import {
  ancestorNodeIdsOf,
  nodeIdOf,
  siblingKeyOf,
  zoneOf,
} from '../../core/columnNodes'
import type { HeadCellDecoratorProps } from '../../core/pluginWrappers'
import { useTableState } from '../../core/reactivity'
import { ItemSortableContextProvider } from '../../shared/dnd'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'
import { getDisabledSortable } from './disabledSortable'
import { NodeShiftContext, noopSubscribe } from './nodeShift'

export const SortableHeadCell = memo(
  ({ Cell, ...props }: HeadCellDecoratorProps) => {
    const { header } = props
    const node = header as never

    const disabledSortable = getDisabledSortable(header)
    const isGroup = header.subHeaders.length > 0
    const nodeId = nodeIdOf(header.column, zoneOf(node))
    const ancestors = useMemo(() => ancestorNodeIdsOf(node), [node])
    // Узел с переносом в ожидании не тянут, но на него бросают (ADR 0114).
    const movePending = useTableState(
      header.getContext().table as never,
      (state: unknown) =>
        !!(state as { columnMoves?: Record<string, unknown> }).columnMoves?.[
          header.column.id
        ],
    ) as boolean

    const {
      setActivatorNodeRef,
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useSortable({
      id: header.id,
      data: {
        type: 'column',
        siblingKey: siblingKeyOf(node),
        disabledSortable,
      },
      disabled: {
        draggable: disabledSortable || movePending,
        droppable: disabledSortable,
      },
    })

    const ownX = disabledSortable ? 0 : (transform?.x ?? 0)
    const store = useContext(NodeShiftContext)
    useIsomorphicLayoutEffect(() => {
      if (isGroup) store?.set(nodeId, ownX)
    }, [store, isGroup, nodeId, ownX])

    const inherited = useSyncExternalStore(
      store && ancestors.length > 0 ? store.subscribe : noopSubscribe,
      () =>
        store && ancestors.length > 0 ? store.snapshot(ancestors) : '0|false',
    )
    const [inheritedX, inheritedHidden] = inherited.split('|')

    const cell = (
      <Cell
        {...props}
        drag={{
          setNodeRef,
          transformX: ownX || Number(inheritedX),
          dragging: isDragging || inheritedHidden === 'true',
          busy: movePending,
        }}
      />
    )
    return disabledSortable ? (
      cell
    ) : (
      <ItemSortableContextProvider
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
        attributes={attributes}
      >
        {cell}
      </ItemSortableContextProvider>
    )
  },
)

SortableHeadCell.displayName = 'SortableHeadCell'
