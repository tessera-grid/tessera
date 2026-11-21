/** Касания в гайдах историй (ADR 0231, §10): CDP в тестах, автоматический жест в живом Storybook. */
import type { StoryProps } from '../DataGridStory.types'
import { setInputModality, trackInputModality } from '../../core/inputModality'
import { stepAction } from '../demos/GuideStory'
import { GUIDE_REAL_INPUT } from '../demos/guideFocus'
import { centerOf, FRESH_ATTR, pollUntil, settle, sleep } from './catalogPlay'

/** Окно телефона в Storybook. */
export const PHONE = { viewport: { value: 'mobile2', isRotated: false } }

/** Плагины с целями под палец. */
export const TOUCH_ARGS = {
  enableColumnSorting: true,
  enableColumnSizing: true,
  enableColumnDragging: true,
  enableHeaderActionMenu: true,
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

interface TouchPointValue {
  identifier: number
  target: EventTarget | null
  clientX: number
  clientY: number
}

const fireTouchEvent = (
  target: EventTarget,
  type: string,
  touches: readonly TouchPointValue[],
  end = false,
) => {
  if (typeof Touch !== 'undefined' && typeof TouchEvent !== 'undefined') {
    let points: Touch[]
    try {
      points = touches.map(
        point =>
          new Touch({
            identifier: point.identifier,
            target: point.target!,
            clientX: point.clientX,
            clientY: point.clientY,
          }),
      )
    } catch {
      // WebKit объявляет Touch, но запрещает его создание из JS.
      points = []
    }
    if (points.length > 0) {
      target.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: end ? [] : points,
          targetTouches: end ? [] : points,
          changedTouches: points,
        }),
      )
      return
    }
  }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    touches: end ? [] : touches,
    targetTouches: end ? [] : touches,
    changedTouches: touches,
  })
  target.dispatchEvent(event)
}

/** Полный tap: указатель, касание, совместимые события мыши, фокус и щелчок. */
export const tapTarget = (target: Element | null | undefined) => {
  if (!target) return
  const at = centerOf(target)
  const touch = {
    identifier: 7,
    target,
    clientX: at.x,
    clientY: at.y,
  }
  const fireTouch = (type: string, end = false) =>
    fireTouchEvent(target, type, [touch], end)
  touchPointer(target, 'pointerdown', at)
  fireTouch('touchstart')
  touchPointer(target, 'mousedown', at, 'mouse')
  if (target instanceof HTMLElement) target.focus({ preventScroll: true })
  touchPointer(target, 'pointerup', at)
  fireTouch('touchend', true)
  touchPointer(target, 'mouseup', at, 'mouse')
  if (target instanceof HTMLElement) target.click()
}

export const resetTouchInput = () => {
  trackInputModality()
  tapTarget(document.body)
}

/** Палец коснулся кнопки: признак касания на корне и нажатие. */
export const tapButton = (target: HTMLElement | null | undefined) => {
  if (!target) return
  tapTarget(target)
}

type RealTapDriver = (at: { x: number; y: number }) => Promise<void>
let realTapDriver: RealTapDriver | undefined

/** Тестовая среда подключает CDP; живой Storybook выполняет шаг сам, как остальные гайды. */
export const setRealTapDriver = (driver: RealTapDriver) => {
  realTapDriver = driver
}

const revealTarget = (element: Element) => {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/** Касание ячейки: CDP в каталоге, автоматическое действие гайда в живом Storybook. */
export const realTapTarget = (
  target: (root: HTMLElement) => Element | null | undefined,
  settled?: (root: HTMLElement) => boolean,
) =>
  stepAction(async (root, { signal }) => {
    await pollUntil(() => !!target(root), signal)
    const element = target(root)
    if (!element) return
    revealTarget(element)
    await settle()
    root.setAttribute(GUIDE_REAL_INPUT, '')
    const tap = async () => {
      if (
        realTapDriver &&
        !root.hasAttribute('data-guide-replaying') &&
        !document.documentElement.hasAttribute(FRESH_ATTR)
      ) {
        const rect = element.getBoundingClientRect()
        const at = {
          x: rect.left + Math.min(8, rect.width / 2),
          y: rect.top + rect.height / 2,
        }
        await realTapDriver(at)
      } else tapTarget(element)
    }
    try {
      if (!settled) {
        await tap()
      } else {
        for (let attempt = 0; attempt < 3; attempt++) {
          await tap()
          try {
            await pollUntil(() => settled(root), signal, 1000)
            break
          } catch (error) {
            if (attempt === 2) throw error
          }
        }
      }
    } finally {
      root.removeAttribute(GUIDE_REAL_INPUT)
    }
  })

interface TouchPoint {
  x: number
  y: number
}

type RealTouchDragDriver = (
  from: TouchPoint,
  to: TouchPoint,
  hold: boolean,
) => Promise<void>
let realTouchDragDriver: RealTouchDragDriver | undefined

export const setRealTouchDragDriver = (driver: RealTouchDragDriver) => {
  realTouchDragDriver = driver
}

export const clearRealTouchDrivers = () => {
  realTapDriver = undefined
  realTouchDragDriver = undefined
}

export const hasRealTouchDrivers = (root?: HTMLElement) =>
  !!realTapDriver &&
  !!realTouchDragDriver &&
  !root?.hasAttribute('data-guide-replaying') &&
  !(root?.ownerDocument ?? document).documentElement.hasAttribute(FRESH_ATTR)

const syntheticTouchDrag = async (
  target: HTMLElement,
  to: TouchPoint,
  hold: boolean,
  signal: AbortSignal,
) => {
  const from = centerOf(target)
  const at = (point: TouchPoint) => ({
    identifier: 3,
    target,
    clientX: point.x,
    clientY: point.y,
  })
  const fire = (
    node: EventTarget,
    type: string,
    point: TouchPoint,
    end = false,
  ) => {
    fireTouchEvent(node, type, [at(point)], end)
  }
  touchPointer(target, 'pointerdown', from)
  fire(target, 'touchstart', from)
  if (hold) await sleep(300)
  const steps = hold ? 12 : 1
  for (let step = 1; step <= steps; step++) {
    signal.throwIfAborted()
    const point = {
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    }
    fire(target, 'touchmove', point)
    await sleep(16)
  }
  if (hold) await sleep(50)
  signal.throwIfAborted()
  fire(target, 'touchend', to, true)
  touchPointer(target, 'pointerup', to)
}

/** Перенос пальцем: `hold: false` — ранний сдвиг, который не должен стать переносом. */
export const realTouchDragTarget = (
  target: (root: HTMLElement) => HTMLElement | null | undefined,
  destination: (root: HTMLElement) => TouchPoint,
  hold = true,
) =>
  stepAction(async (root, { signal }) => {
    await pollUntil(() => !!target(root), signal)
    const element = target(root)
    if (!element) return
    setInputModality('touch')
    revealTarget(element)
    await settle()
    const from = centerOf(element.querySelector('svg') ?? element)
    const to = destination(root)
    root.setAttribute(GUIDE_REAL_INPUT, '')
    try {
      if (
        realTouchDragDriver &&
        !root.hasAttribute('data-guide-replaying') &&
        !document.documentElement.hasAttribute(FRESH_ATTR)
      )
        await realTouchDragDriver(from, to, hold)
      else await syntheticTouchDrag(element, to, hold, signal)
    } finally {
      root.removeAttribute(GUIDE_REAL_INPUT)
    }
  })

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
  const at = (x: number) => ({
    identifier: 3,
    target,
    clientX: x,
    clientY: from.y,
  })
  const fire = (node: EventTarget, type: string, x: number, end = false) => {
    fireTouchEvent(node, type, [at(x)], end)
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
