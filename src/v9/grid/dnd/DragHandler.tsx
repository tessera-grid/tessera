import type { MouseEvent, PointerEvent, TouchEvent } from 'react'

import clsx from 'clsx'

import { useItemSortableContext } from './ItemSortableContext'
import { useIcons } from '../../../lib/ui/icons'

import styles from '../../../lib/grid/dnd/DragHandler.module.css'
import '../../../lib/grid/cellControls/buttonVisibility.css'

export interface DragHandlerProps {
  id: string
  type: string
  disabled?: boolean
  onClick?: (e: MouseEvent | PointerEvent | TouchEvent) => void
}

export const DragHandler = ({ disabled, onClick }: DragHandlerProps) => {
  const { drag: DragIcon } = useIcons()

  const { setActivatorNodeRef, attributes, listeners } =
    useItemSortableContext()

  return (
    <span
      ref={setActivatorNodeRef}
      className={clsx(styles.button, 'drag__handler--column', {
        [styles.disabled]: disabled,
      })}
      {...attributes}
      {...listeners}
      onMouseDown={e => {
        if (!disabled) onClick?.(e)

        listeners?.onMouseDown?.(e)
      }}
      onPointerDown={e => {
        if (!disabled) onClick?.(e)

        listeners?.onPointerDown?.(e)
      }}
      onTouchStart={e => {
        if (!disabled) onClick?.(e)

        listeners?.onTouchStart?.(e)
      }}
    >
      <DragIcon
        className={clsx(
          'cell__button',
          'cell__button--hidden',
          'row__button',
          'row__button--hidden',
        )}
      />
    </span>
  )
}

DragHandler.displayName = 'DragHandler'
