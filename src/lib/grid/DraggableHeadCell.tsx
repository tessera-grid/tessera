import { memo, useContext, useMemo, useSyncExternalStore } from 'react'

import { useSortable } from '@dnd-kit/sortable'

import {
  ancestorNodeIdsOf,
  nodeIdOf,
  siblingKeyOf,
  zoneOf,
} from '../core/columnNodes'
import { HeadCellView, type TableHeadCellProps } from './HeadCell'
import { NodeShiftContext, noopSubscribe } from './dnd/nodeShift'
import { getDisabledSortable } from './headCellParams'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'

/**
 * Ячейка заголовка с включённым Drag&Drop: регистрирует узел (лист или группу) в
 * SortableContext его соседей; для закреплённых/служебных сортировка отключается
 * через `disabled`. Ячейки под группой сдвигаются и скрываются вместе с ней (ND4).
 */
export const DraggableHeadCell = memo((props: TableHeadCellProps) => {
  const { header } = props
  const node = header as never

  const disabledSortable = getDisabledSortable(header)
  const isGroup = header.subHeaders.length > 0
  const nodeId = nodeIdOf(header.column, zoneOf(node))
  const ancestors = useMemo(() => ancestorNodeIdsOf(node), [node])

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
    disabled: disabledSortable,
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

  return (
    <HeadCellView
      {...props}
      disabledSortable={disabledSortable}
      drag={{
        setNodeRef,
        setActivatorNodeRef,
        listeners,
        attributes,
        transformX: ownX || Number(inheritedX),
        isDragging: isDragging || inheritedHidden === 'true',
      }}
    />
  )
})

DraggableHeadCell.displayName = 'DraggableHeadCell'
