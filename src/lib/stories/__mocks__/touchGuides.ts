/**
 * Касания в гайдах историй (ADR 0231, §10): события пальца без Playwright — шаги гайда
 * воспроизводят тот же путь, что человек на телефоне.
 */
import type { StoryProps } from '../DataGridStory.types'
import { centerOf, sleep } from './catalogPlay'

/** Окно телефона в Storybook. */
export const PHONE = { viewport: { value: 'mobile2', isRotated: false } }

/** Плагины с целями под палец. */
export const TOUCH_ARGS = {
  enableColumnSorting: true,
  enableColumnSizing: true,
  enableColumnDragging: true,
  enableRowDragging: true,
  enableRowSelection: true,
  enableRowActions: true,
  enableCellEditing: true,
  enableContextMenu: true,
  enableCellSelection: true,
  columnCount: 8,
  dataCount: 60,
  containerWidth: 360,
  height: '460',
} satisfies Partial<StoryProps>

/** Событие указателя пальца в точке `at` (по умолчанию — центр цели). */
export const touchPointer = (
  target: Element,
  type: string,
  at = centerOf(target),
  pointerType: 'touch' | 'mouse' = 'touch',
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: pointerType === 'touch' ? 7 : 1,
      pointerType,
      isPrimary: true,
      clientX: at.x,
      clientY: at.y,
    }),
  )

/** Палец коснулся и отпустил. */
export const tapTarget = (target: Element | null | undefined) => {
  if (!target) return
  touchPointer(target, 'pointerdown')
  touchPointer(target, 'pointerup')
}

/** Палец коснулся кнопки: признак касания на корне и нажатие. */
export const tapButton = (target: HTMLElement | null | undefined) => {
  if (!target) return
  tapTarget(target)
  target.click()
}

/** Палец держат на цели дольше срока долгого нажатия; `move` — сдвиг до срока. */
export const holdTarget = async (
  target: Element,
  signal: AbortSignal,
  move = 0,
) => {
  const at = centerOf(target)
  touchPointer(target, 'pointerdown', at)
  if (move) touchPointer(target, 'pointermove', { x: at.x, y: at.y + move })
  await sleep(700)
  signal.throwIfAborted()
  touchPointer(target, 'pointerup', { x: at.x, y: at.y + move })
}

/** Мышь сдвинулась по документу. */
export const moveMouse = () =>
  touchPointer(document.body, 'pointermove', { x: 1, y: 1 }, 'mouse')

/** Палец тянет цель на `dx` событиями касания. */
export const touchDrag = async (
  target: HTMLElement,
  dx: number,
  signal: AbortSignal,
) => {
  const from = centerOf(target)
  const at = (x: number) =>
    new Touch({ identifier: 3, target, clientX: x, clientY: from.y })
  const fire = (node: EventTarget, type: string, x: number, end = false) => {
    const touch = at(x)
    node.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: end ? [] : [touch],
        targetTouches: end ? [] : [touch],
        changedTouches: [touch],
      }),
    )
  }
  fire(target, 'touchstart', from.x)
  for (let i = 1; i <= 8; i++) {
    signal.throwIfAborted()
    fire(document, 'touchmove', from.x + (dx * i) / 8)
    await sleep(16)
  }
  fire(document, 'touchend', from.x + dx, true)
}

export const openMenu = () =>
  document.querySelector<HTMLElement>('[role="menu"]')
