import { memo, useMemo } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import clsx from 'clsx'

import {
  NAV_ROW_ATTR,
  useKeyboardNavigationRow,
} from '../core/keyboardNavigation'
import { animateLayoutChanges } from '../plugins/rowDragging'
import {
  BodyRowCells,
  type TableBodyRowProps,
  getAriaSelected,
  useRowStateSubscription,
} from './BodyRow'
import { ItemDraggableWrapper } from './dnd'

import styles from '../grid/BodyRow/BodyRow.module.css'

/**
 * Ряд тела с включённым Drag&Drop: регистрирует ряд в SortableContext и управляет
 * стилями/состоянием перетаскивания (offset-индикатор вложенности через CSS-var).
 */
export const DraggableBodyRow = memo((props: TableBodyRowProps) => {
  const { row, virtualRow, ariaRowIndexBase } = props

  useRowStateSubscription(row)
  const nav = useKeyboardNavigationRow(
    (row as unknown as { table: unknown }).table,
    virtualRow.index,
  )

  const canExpand = row.getCanExpand?.() ?? false
  const isExpanded = row.getIsExpanded?.() ?? false

  const {
    setActivatorNodeRef,
    attributes,
    listeners,
    setDraggableNodeRef,
    setDroppableNodeRef,
    transform,
    overIndex,
    isDragging,
  } = useSortable({
    id: row.id,
    data: {
      type: 'row',
      virtualIndex: virtualRow.index,
      row,
      parentRow: row.getParentRow(),
    },
    animateLayoutChanges,
  })

  const isRowInteract = overIndex === -1

  const rowStyles = useMemo(
    () => ({
      top: virtualRow.start,
      transform: `translate3d(var(--draggable-row-${row.id}-offset-left, 0px), ${transform?.y ?? 0}px, 0px)`,
    }),
    [row.id, transform?.y, virtualRow.start],
  )

  return (
    <div
      ref={node => {
        setDraggableNodeRef(node)
        setDroppableNodeRef(node)
        if (nav) {
          nav.ref.current = node
        }
      }}
      {...(nav && {
        tabIndex: nav.tabIndex,
        onFocus: nav.onFocus,
        onBlur: nav.onBlur,
        [NAV_ROW_ATTR]: '',
      })}
      data-kn-active={nav?.isActive || undefined}
      className={clsx('data-grid__body-row', styles.body__row)}
      role="row"
      aria-rowindex={ariaRowIndexBase + virtualRow.index + 1}
      aria-expanded={canExpand ? isExpanded : undefined}
      aria-selected={getAriaSelected(row, props.selectableRows)}
      {...props.treeAria}
      data-index={virtualRow.index}
      data-row-id={row.id}
      data-selected={row.getIsSelected?.() ?? false}
      data-expanded={canExpand ? isExpanded : undefined}
      data-group-row={row.getIsGrouped?.() ?? false}
      data-row-odd={virtualRow.index % 2 !== 0}
      data-row-draggable={isDragging}
      data-row-interact={isRowInteract}
      data-last-row={row.getIsLastRow()}
      data-layout={props.layout}
      style={rowStyles}
    >
      <ItemDraggableWrapper
        isRowDraggingEnable={row.getCanDrag()}
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
        attributes={attributes}
      >
        <BodyRowCells {...props} isRowInteract={isRowInteract} />
      </ItemDraggableWrapper>
    </div>
  )
})

DraggableBodyRow.displayName = 'DraggableBodyRow'
