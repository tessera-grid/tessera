// Холст историй поповеров кита (ADR 0183, PK8): открытый поповер под кнопкой-якорем на холсте
// темы. Поповер — в портале, место под ним оставлено, чтобы снимок его захватил. История стоит
// в покое: фокус на открытый поповер не ставится — у поповера это `initialFocus={false}` его
// попапа, у меню (Base UI фокусирует открытое меню всегда) — снятие начального фокуса здесь.
import { type ReactNode, useLayoutEffect } from 'react'

import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'

import { Button } from '../../ui/Button'
import { UiCanvas } from './UiCanvas'

interface PopupCanvasProps {
  /** Примитив Base UI: поповер или меню. */
  kind?: 'popover' | 'menu'
  /** Высота места под поповером. */
  height?: number
  children: ReactNode
}

/** Сколько ждать начального фокуса меню: дальше фокус — у человека. */
const INITIAL_FOCUS_WINDOW_MS = 1000

const inPopup = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement &&
  !!target.closest('[role="menu"], [role="dialog"]')

/**
 * Снимает фокус, который меню или поповер Base UI ставит на себя при открытии: компонент кита,
 * открывающий свой попап сам (меню ручки, поповер отметки ячейки), фокус не отключает.
 */
export const useNoInitialPopupFocus = (enabled = true) => {
  useLayoutEffect(() => {
    if (!enabled) return
    const stop = () => {
      window.clearTimeout(timer)
      document.removeEventListener('focusin', onFocusIn)
    }
    const onFocusIn = (event: FocusEvent) => {
      if (!inPopup(event.target)) return
      event.target.blur()
      stop()
    }
    document.addEventListener('focusin', onFocusIn)
    const timer = window.setTimeout(stop, INITIAL_FOCUS_WINDOW_MS)
    return stop
  }, [enabled])
}

export const PopupCanvas = ({
  kind = 'popover',
  height = 360,
  children,
}: PopupCanvasProps) => {
  useNoInitialPopupFocus(kind === 'menu')
  return (
    <UiCanvas>
      <div style={{ width: 360, height }}>
        {kind === 'menu' ? (
          <Menu.Root open modal={false}>
            <Menu.Trigger render={<Button variant="outline">Anchor</Button>} />
            {children}
          </Menu.Root>
        ) : (
          <Popover.Root open modal={false}>
            <Popover.Trigger
              render={<Button variant="outline">Anchor</Button>}
            />
            {children}
          </Popover.Root>
        )}
      </div>
    </UiCanvas>
  )
}
