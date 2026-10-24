import { memo, useMemo, useRef } from 'react'

import { useSortable } from '@dnd-kit/sortable'
import clsx from 'clsx'

import {
  NAV_ROW_ATTR,
  useKeyboardNavigationRow,
} from '../core/keyboardNavigation'
import { usePluginRenderVersion } from '../core/renderVersion'
import { hasExpandToggle } from '../core/keyboardActions'
import { animateLayoutChanges } from '../plugins/rowDragging'
import {
  BodyRowCells,
  type TableBodyRowProps,
  getAriaSelected,
  useRowStateSubscription,
} from './BodyRow'
import { ItemDraggableWrapper } from './dnd'
import { highlightRender } from './highlight'
import { flashRender } from './flash'
import { useSlotGlide } from './rowMotion/useSlotGlide'
import { useIsomorphicLayoutEffect } from '../core/useIsomorphicLayoutEffect'

import styles from '../grid/BodyRow/BodyRow.module.css'

/** Сдвиг строки от dnd-kit; уровень слота — отступом ячейки (ADR 0108, §2). */
const transformAt = (y: number) => `translate3d(0px, ${y}px, 0px)`

/**
 * Ряд тела с включённым Drag&Drop: регистрирует ряд в SortableContext и управляет
 * стилями/состоянием перетаскивания (offset-индикатор вложенности через CSS-var).
 */
export const DraggableBodyRow = memo((props: TableBodyRowProps) => {
  const { row, virtualRow, ariaRowIndexBase } = props

  const { highlight, flash, moving, movePending } = useRowStateSubscription(row)
  // Предикат `canDragRow` с новой ссылкой (ADR 0039, RX23) включает ручку строки мимо мемоизации.
  usePluginRenderVersion()
  const highlighted = highlightRender([{ layer: 'row', state: highlight }])
  const flashed = flashRender([{ layer: 'row', entry: flash }])
  const nav = useKeyboardNavigationRow(
    (row as unknown as { table: unknown }).table,
    virtualRow.index,
  )

  const canExpand = row.getCanExpand?.() ?? false
  // Состояние раскрытия строки озвучивается, только если его можно менять (ADR 0119).
  const canToggle =
    canExpand && hasExpandToggle((row as { table: unknown }).table)
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
    disabled: { draggable: moving, droppable: false },
    animateLayoutChanges,
  })

  const isRowInteract = overIndex === -1
  const node = useRef<HTMLDivElement | null>(null)
  // dnd-kit гасит сдвиги на рендер, в котором сменились строки окна (группа раскрылась
  // посреди сессии): строка держит прежний сдвиг, иначе соседи на кадр встают на места
  // раскладки и едут обратно (ADR 0109). `undefined` — держать.
  const shift = transform?.y ?? (isSorting && !isRowInteract ? undefined : 0)
  useSlotGlide(node, shift, isDragging, transformAt)
  useIsomorphicLayoutEffect(() => {
    if (shift !== undefined && node.current) {
      node.current.style.transform = transformAt(shift)
    }
  }, [shift])

  const rowStyles = useMemo(
    () => ({ top: virtualRow.start }),
    [virtualRow.start],
  )

  return (
    <div
      ref={element => {
        node.current = element
        setDraggableNodeRef(element)
        setDroppableNodeRef(element)
        if (nav) {
          nav.ref.current = element
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
        canToggle && props.treeSetSize !== undefined ? isExpanded : undefined
      }
      aria-busy={isExpandPending || movePending || undefined}
      aria-selected={getAriaSelected(row, props.selectableRows)}
      aria-level={props.treeSetSize !== undefined ? row.depth + 1 : undefined}
      aria-setsize={props.treeSetSize}
      aria-posinset={props.treePosInSet}
      data-index={virtualRow.index}
      data-row-id={row.id}
      data-selected={row.getIsSelected?.() ?? false}
      data-expanded={canExpand ? isExpanded : undefined}
      data-group-row={row.getIsGrouped?.() ?? false}
      {...highlighted.attrs}
      {...flashed.attrs}
      data-row-odd={virtualRow.index % 2 !== 0}
      data-row-draggable={isDragging}
      data-row-drop-parent={props.dropParent || undefined}
      data-row-interact={isRowInteract}
      data-last-row={row.getIsLastRow()}
      data-layout={props.layout}
      style={
        highlighted.style || flashed.style
          ? { ...rowStyles, ...highlighted.style, ...flashed.style }
          : rowStyles
      }
    >
      <ItemDraggableWrapper
        isRowDraggingEnable={row.getCanDrag()}
        setActivatorNodeRef={setActivatorNodeRef}
        listeners={listeners}
        attributes={attributes}
      >
        <BodyRowCells
          {...props}
          // Слот — по dnd-kit, как `data-row-draggable`: в React 18 его старт коммитится
          // позже атома перетаскивания.
          slotDepth={isDragging ? props.slotDepth : undefined}
          isRowInteract={isRowInteract}
        />
      </ItemDraggableWrapper>
    </div>
  )
})

DraggableBodyRow.displayName = 'DraggableBodyRow'
