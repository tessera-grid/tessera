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
import { highlightRender } from './highlight'

import styles from '../grid/BodyRow/BodyRow.module.css'

/**
 * Ряд тела с включённым Drag&Drop: регистрирует ряд в SortableContext и управляет
 * стилями/состоянием перетаскивания (offset-индикатор вложенности через CSS-var).
 */
export const DraggableBodyRow = memo((props: TableBodyRowProps) => {
  const { row, virtualRow, ariaRowIndexBase } = props

  const { arrived, highlight } = useRowStateSubscription(row)
  const highlighted = highlightRender([{ layer: 'row', state: highlight }])
  const nav = useKeyboardNavigationRow(
    (row as unknown as { table: unknown }).table,
    virtualRow.index,
  )

  const canExpand = row.getCanExpand?.() ?? false
  const isExpanded = row.getIsExpanded?.() ?? false
  // Раскрытие ждёт промиса onExpandRow (ADR 0041, §3).
  const isExpandPending =
    (row as { getIsExpandPending?: () => boolean }).getIsExpandPending?.() ??
    false

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
      // aria-expanded строки допустим только в treegrid; в table состояние несёт
      // кнопка раскрытия (ADR 0015, RE10, RE12).
      aria-expanded={
        canExpand && props.treeSetSize !== undefined ? isExpanded : undefined
      }
      aria-busy={isExpandPending || undefined}
      aria-selected={getAriaSelected(row, props.selectableRows)}
      aria-level={props.treeSetSize !== undefined ? row.depth + 1 : undefined}
      aria-setsize={props.treeSetSize}
      aria-posinset={props.treePosInSet}
      data-index={virtualRow.index}
      data-row-id={row.id}
      data-selected={row.getIsSelected?.() ?? false}
      data-expanded={canExpand ? isExpanded : undefined}
      data-group-row={row.getIsGrouped?.() ?? false}
      data-arrived={arrived || undefined}
      {...highlighted.attrs}
      data-row-odd={virtualRow.index % 2 !== 0}
      data-row-draggable={isDragging}
      data-row-interact={isRowInteract}
      data-last-row={row.getIsLastRow()}
      data-layout={props.layout}
      style={
        highlighted.style ? { ...rowStyles, ...highlighted.style } : rowStyles
      }
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
