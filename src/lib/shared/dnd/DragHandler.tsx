import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
  useRef,
} from 'react'

import type { HeaderMenuItem } from '../../core/headerActions'
import { HandleMenu, useHandleMenu } from '../handleMenu/HandleMenu'
import { useItemSortableContext } from './ItemSortableContext'
import { DRAG_ACTIVATION_DISTANCE } from './parameters'
import { DragHandle } from '../../ui/DragHandle/DragHandle'

export interface DragHandlerProps {
  id: string
  type: string
  onClick?: (e: MouseEvent | PointerEvent | TouchEvent) => void
  /** Доступное имя ручки — кнопки меню перестановки. */
  label?: string
  /** Пункты меню перестановки (WCAG 2.5.7); без них ручка — только для DnD. */
  getMenuItems?: () => HeaderMenuItem[]
  disabled?: boolean
  /** Таблица — для объявления ошибки загрузки меню (ADR 0061). */
  table?: unknown
  /** Перенос ждёт промиса: меню не открывается; ожидание — волной на объекте (ADR 0177, §1). */
  busy?: boolean
}

export const DragHandler = ({
  type,
  disabled,
  onClick,
  label,
  getMenuItems,
  table,
  busy = false,
}: DragHandlerProps) => {
  const ref = useRef<HTMLElement | null>(null)
  const pressedAt = useRef<{ x: number; y: number } | null>(null)
  const menu = useHandleMenu(
    table,
    () => label ?? '',
    type === 'row' ? 'rowDragging' : 'columnDragging',
  )

  const { setActivatorNodeRef, attributes, listeners } =
    useItemSortableContext()
  // Инструкции dnd-kit описывают KeyboardSensor, которого в гриде нет.
  const {
    'aria-describedby': _describedBy,
    'aria-roledescription': _roleDescription,
    ...ownAttributes
  } = attributes

  const hasMenu = !!getMenuItems && !disabled && !busy

  const movedFrom = (x: number, y: number) => {
    const start = pressedAt.current
    return (
      !!start &&
      Math.hypot(x - start.x, y - start.y) >= DRAG_ACTIVATION_DISTANCE
    )
  }

  // Касание без сдвига — меню по отпусканию пальца. Отмена `touchend` гасит
  // `mousedown` и `click` касания: первый закрыл бы меню как нажатие на триггер, а
  // второго браузер не всегда присылает (ADR 0086, TU10).
  const onMenuTouchEnd = (event: TouchEvent<HTMLSpanElement>) => {
    const touch = event.changedTouches[0]
    if (!touch || movedFrom(touch.clientX, touch.clientY)) return
    if (event.cancelable) event.preventDefault()
    menu.request()
  }

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
    menu.request()
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      menu.request()
    } else if (event.key === 'Escape') {
      menu.trigger.onCancel()
    }
  }

  const setNode = (node: HTMLElement | null) => {
    ref.current = node
    setActivatorNodeRef(node)
  }
  const handleMenu = menu.open && hasMenu && (
    <HandleMenu
      anchor={ref}
      label={label ?? ''}
      getItems={getMenuItems}
      onClose={menu.close}
      table={table}
      plugin={type === 'row' ? 'rowDragging' : 'columnDragging'}
    />
  )

  return (
    <DragHandle
      ref={setNode}
      kind={type === 'row' ? 'row' : 'column'}
      menu={handleMenu}
      disabled={disabled}
      // Дуга — только загрузка меню ручки, процесс вне таблицы (ADR 0177, §2).
      pending={menu.trigger.pending}
      failed={menu.trigger.failed}
      {...ownAttributes}
      aria-label={label}
      {...(hasMenu && {
        'aria-haspopup': 'menu' as const,
        'aria-expanded': menu.open,
        onClick: onMenuClick,
        onTouchEnd: onMenuTouchEnd,
        onKeyDown: onMenuKeyDown,
        onPointerEnter: menu.trigger.onIntent,
        onFocus: menu.trigger.onIntent,
        onBlur: menu.trigger.onCancel,
      })}
      {...listeners}
      onMouseDown={e => {
        onClick?.(e)
        listeners?.onMouseDown?.(e)
      }}
      onPointerDown={e => {
        onClick?.(e)
        pressedAt.current = { x: e.clientX, y: e.clientY }
        listeners?.onPointerDown?.(e)
      }}
      onTouchStart={e => {
        onClick?.(e)
        listeners?.onTouchStart?.(e)
      }}
    />
  )
}

DragHandler.displayName = 'DragHandler'
