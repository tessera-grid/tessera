import { useRef } from 'react'

import { focusStayed } from '../../ui/Popup/finalFocus'

/** Причина закрытия меню прокруткой грида пользователем (ADR 0085, MM4). */
export const GRID_SCROLL_REASON = 'wheel'

// Пользователь ушёл из меню: нажал мимо, увёл фокус, прокрутил грид.
const LEAVING = new Set(['outside-press', 'focus-out', GRID_SCROLL_REASON])

/**
 * Возврат фокуса на триггер при закрытии меню (Base UI `finalFocus`): только если
 * пользователь не ушёл сам. Иначе фокус, вернувшийся посреди нажатия мимо, сорвал бы
 * это нажатие (ADR 0085, MM2), а после прокрутки — прокрутил бы грид обратно к кнопке.
 * Возврат идёт в конце анимации закрытия: если к этому времени фокус уже у другого
 * элемента (нажали другой триггер), он остаётся там (MM6).
 */
export const useMenuLeave = () => {
  const left = useRef(false)
  const popupRef = useRef<HTMLDivElement>(null)
  return {
    /** Отметить смену открытия — из `onOpenChange`. */
    track: (open: boolean, reason?: string) => {
      left.current = !open && !!reason && LEAVING.has(reason)
    },
    /** Ref попапа меню (`Menu.Popup`). */
    popupRef,
    returnFocus: () => !left.current && focusStayed(popupRef.current),
  }
}
