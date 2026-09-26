import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
  useRef,
  useState,
} from 'react'

import clsx from 'clsx'

import type { HeaderMenuItem } from '../../core/headerActions'
import { HandleMenu } from '../handleMenu/HandleMenu'
import { useItemSortableContext } from './ItemSortableContext'
import { DRAG_ACTIVATION_DISTANCE } from './parameters'
import { useIcons } from '../../ui/icons'

import styles from '../../grid/dnd/DragHandler.module.css'
import '../../grid/cellControls/buttonVisibility.css'

export interface DragHandlerProps {
  id: string
  type: string
  disabled?: boolean
  onClick?: (e: MouseEvent | PointerEvent | TouchEvent) => void
  /** Доступное имя ручки — кнопки меню перестановки. */
  label?: string
  /** Пункты меню перестановки (WCAG 2.5.7); без них ручка — только для DnD. */
  getMenuItems?: () => HeaderMenuItem[]
}

export const DragHandler = ({
  disabled,
  onClick,
  label,
  getMenuItems,
}: DragHandlerProps) => {
  const { drag: DragIcon } = useIcons()
  const ref = useRef<HTMLSpanElement | null>(null)
  const pressedAt = useRef<{ x: number; y: number } | null>(null)
  const [open, setOpen] = useState(false)

  const { setActivatorNodeRef, attributes, listeners } =
    useItemSortableContext()
  // Инструкции dnd-kit описывают KeyboardSensor, которого в гриде нет.
  const {
    'aria-describedby': _describedBy,
    'aria-roledescription': _roleDescription,
    ...ownAttributes
  } = attributes

  const hasMenu = !!getMenuItems && !disabled

  const onMenuClick = (event: MouseEvent<HTMLSpanElement>) => {
    const start = pressedAt.current
    pressedAt.current = null
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >=
        DRAG_ACTIVATION_DISTANCE
    ) {
      return
    }
    setOpen(true)
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <>
      <span
        ref={node => {
          ref.current = node
          setActivatorNodeRef(node)
        }}
        className={clsx(styles.button, 'drag__handler--column', {
          [styles.disabled]: disabled,
        })}
        {...ownAttributes}
        {...(hasMenu && {
          'aria-label': label,
          'aria-haspopup': 'menu' as const,
          'aria-expanded': open,
          onClick: onMenuClick,
          onKeyDown: onMenuKeyDown,
        })}
        {...listeners}
        onMouseDown={e => {
          if (!disabled) onClick?.(e)

          listeners?.onMouseDown?.(e)
        }}
        onPointerDown={e => {
          if (!disabled) onClick?.(e)
          pressedAt.current = { x: e.clientX, y: e.clientY }

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
      {open && hasMenu && (
        <HandleMenu
          anchor={ref}
          label={label ?? ''}
          getItems={getMenuItems}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

DragHandler.displayName = 'DragHandler'
