import { MouseEvent, PointerEvent, TouchEvent } from 'react'

import clsx from 'clsx'

import { useItemSortableContext } from '../utils/ItemSortableContext'
import { useIcons } from '../../ui/icons'

import bodyRowStyles from '../../ui/BodyRow/BodyRow.module.css'
import headCellStyles from '../../ui/HeadCell/HeadCell.module.css'
import styles from './DragHandler.module.css'

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
          headCellStyles.cell__button,
          headCellStyles['cell__button--hidden'],
          bodyRowStyles.row__button,
          bodyRowStyles['row__button--hidden'],
        )}
      />
    </span>
  )
}

DragHandler.displayName = 'DragHandler'
