import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
  useRef,
} from 'react'

import clsx from 'clsx'

import type { HeaderMenuItem } from '../../core/headerActions'
import { HandleMenu, useHandleMenu } from '../handleMenu/HandleMenu'
import { useItemSortableContext } from './ItemSortableContext'
import { DRAG_ACTIVATION_DISTANCE } from './parameters'
import { useIcons } from '../../ui/icons'
import { IconButton } from '../../ui/IconButton'
import { HiddenButtonContext } from '../../ui/IconButton/iconReveal'

import styles from '../../grid/dnd/DragHandler.module.css'
import '../../ui/cellControls/buttonVisibility.css'

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
  /** Перенос ждёт промиса `onRowDragEnd`: свет ожидания, меню не открывается (ADR 0112). */
  busy?: boolean
  /** Текст отметки отказа переноса (ADR 0136). */
  failure?: string
}

export const DragHandler = ({
  type,
  disabled,
  onClick,
  label,
  getMenuItems,
  table,
  busy = false,
  failure,
}: DragHandlerProps) => {
  const { drag: DragIcon } = useIcons()
  const ref = useRef<HTMLElement | null>(null)
  const pressedAt = useRef<{ x: number; y: number } | null>(null)
  const menu = useHandleMenu(table, () => label ?? '')

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
  // Квадратная кнопка кита: ожидание и отметка отказа — как у кнопок (ADR 0112, 0114,
  // 0136); отказ загрузки меню — свежее отказа переноса.
  const failed = menu.trigger.failure ?? failure
  const button = (
    <IconButton
      ref={setNode}
      shape="square"
      size="compact"
      disabled={disabled}
      className={clsx(styles.handle, 'drag__handler--column')}
      pending={busy || menu.trigger.pending}
      failure={failed}
      {...ownAttributes}
      aria-label={label}
      // Подсказка ручки — только причина отказа (ADR 0127, IR10): без отказа её нет.
      label={failed === undefined ? undefined : label}
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
    >
      {/* Строка раскрывает иконку прозрачностью, колонка — обёрткой по ширине. */}
      <DragIcon
        className={clsx(
          type === 'row' && [
            'cell__button',
            'cell__button--hidden',
            'row__button',
            'row__button--hidden',
          ],
        )}
      />
    </IconButton>
  )

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

  return type === 'row' ? (
    <>
      <HiddenButtonContext.Provider value>
        {button}
      </HiddenButtonContext.Provider>
      {handleMenu}
    </>
  ) : (
    // Ручка колонки шириной 0 до наведения: раскрывается и сдвигает подпись (ADR 0114).
    // Меню — внутри обёртки: служебные узлы портала не встают в ряд заголовка.
    <div
      className={clsx(
        'cell__button',
        'cell__button--hidden',
        styles.columnHandle,
      )}
    >
      {button}
      {handleMenu}
    </div>
  )
}

DragHandler.displayName = 'DragHandler'
