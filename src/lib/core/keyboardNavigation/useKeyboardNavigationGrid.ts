import {
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useRef,
} from 'react'

import { applyFollow, trackingOf } from './focus'
import { handleGridKeyDown } from './gridKeyDown'
import {
  NAV_CELL_ATTR,
  NAV_ROW_ATTR,
  type NavTable,
  isKeyboardNavigationEnabled,
} from './model'
import { useIsomorphicLayoutEffect } from '../../util/useIsomorphicLayoutEffect'

export interface KeyboardNavigationGrid {
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onFocusCapture: (event: ReactFocusEvent<HTMLElement>) => void
  onPointerDownCapture: () => void
  /** Стражи Tab-выхода: невидимые `tabindex=-1` до и после контейнера прокрутки. */
  guardBeforeRef: RefObject<HTMLDivElement | null>
  guardAfterRef: RefObject<HTMLDivElement | null>
}

/**
 * Клавиатурный контроллер корня грида; `null` без плагина. В режиме навигации
 * (фокус на ячейке) — стрелки, действия плагинов, вход в режим действия, Tab-выход;
 * в режиме действия (фокус на виджете ячейки) — `Escape` и `Tab` по кругу.
 */
export const useKeyboardNavigationGrid = (
  table: unknown,
  getScrollElement: () => HTMLElement | null,
): KeyboardNavigationGrid | null => {
  const guardBeforeRef = useRef<HTMLDivElement>(null)
  const guardAfterRef = useRef<HTMLDivElement>(null)

  // Перестановка строки применяется, когда потребитель вернёт новые данные.
  useIsomorphicLayoutEffect(() => {
    if (isKeyboardNavigationEnabled(table)) {
      applyFollow(table as NavTable)
    }
  })

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) =>
      handleGridKeyDown(event, {
        table,
        getScrollElement,
        guardBeforeRef,
        guardAfterRef,
      }),
    [table, getScrollElement],
  )

  // Вход в грид с клавиатуры извне (Tab/Shift+Tab попал на виджет) — на активную
  // ячейку. Фокус от указателя (клик по чекбоксу/полю) не перенаправляем.
  const onFocusCapture = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      const tracking = trackingOf(table as NavTable)
      const root = event.currentTarget
      const from = event.relatedTarget as Node | null
      const target = event.target as HTMLElement
      if (
        tracking.pointer ||
        // Фокус в портале (пункты меню) всплывает по React-дереву — не наш вход.
        !root.contains(target) ||
        (from && root.contains(from)) ||
        // Возврат фокуса на триггер из закрывшегося всплывающего окна (меню в
        // портале уже размонтировано — источника нет); вход по Tab его имеет.
        (from === null && target.hasAttribute('aria-haspopup')) ||
        target.hasAttribute(NAV_CELL_ATTR) ||
        target.hasAttribute(NAV_ROW_ATTR)
      ) {
        return
      }
      const activeCell = root.querySelector<HTMLElement>(
        '[data-kn-active="true"]',
      )
      if (activeCell && activeCell !== target) {
        activeCell.focus({ preventScroll: true })
      }
    },
    [table],
  )

  const onPointerDownCapture = useCallback(() => {
    const tracking = trackingOf(table as NavTable)
    tracking.pointer = true
    tracking.follow = undefined
    // Фокус от указателя приходит и по mousedown, и по click — после отпускания
    // (редактор открывается кнопкой). Нажатие длится, пока кнопку не отпустили,
    // в том числе за пределами грида (KN30).
    const release = () => {
      document.removeEventListener('pointerup', release, true)
      document.removeEventListener('pointercancel', release, true)
      setTimeout(() => {
        tracking.pointer = false
      }, 0)
    }
    document.addEventListener('pointerup', release, true)
    document.addEventListener('pointercancel', release, true)
  }, [table])

  return isKeyboardNavigationEnabled(table)
    ? {
        onKeyDown,
        onFocusCapture,
        onPointerDownCapture,
        guardBeforeRef,
        guardAfterRef,
      }
    : null
}
