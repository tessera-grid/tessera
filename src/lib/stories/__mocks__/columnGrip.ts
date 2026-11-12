/**
 * Ручка ширины колонки в шагах гайдов (ADR 0117, SN36): протяжка и меню ручки — события шага,
 * как от мыши пользователя; в живом Storybook гайд показывает нажатие (SN46, SN50).
 */
import type { StepRun } from '../demos/GuideStory'
import { centerOf, openMenuBy, pollUntil, sleep } from './catalogPlay'

const GRIP = '.resize__handler--column'

/** Ручка ширины колонки — у правой границы её заголовка. */
export const gripOf = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"] ${GRIP}`,
  )

export const separatorOf = (root: ParentNode, id: string) =>
  gripOf(root, id)?.querySelector<HTMLElement>('[role="separator"]') ?? null

/**
 * Протяжка ручки, которую держит шаг (ADR 0197): нажатие и движение — события шага, мышь
 * человека протяжку не ведёт и не отпускает; уход с шага отпускает ручку там, где её
 * держали. `to` — куда шаг уводит указатель от черты.
 */
export const holdGrip = async (
  root: HTMLElement,
  step: StepRun,
  id: string,
  to: (from: { x: number; y: number }) => number,
) => {
  const from = centerOf(separatorOf(root, id)!)
  const ours = new WeakSet<Event>()
  const fire = (type: string, target: EventTarget, x: number) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
      clientX: x,
      clientY: from.y,
    })
    ours.add(event)
    target.dispatchEvent(event)
  }
  let at = from.x
  // Движение в точке удержания — повтор автопрокрутки у края (ADR 0197, §5): пропускается.
  const shield = (event: Event) => {
    const repeat =
      event.type === 'mousemove' && (event as MouseEvent).clientX === at
    if (!ours.has(event) && !repeat) event.stopPropagation()
  }
  for (const type of ['mousemove', 'mouseup']) {
    window.addEventListener(type, shield, true)
  }
  let released = false
  const release = () => {
    if (released) return
    released = true
    fire('mouseup', document, at)
    for (const type of ['mousemove', 'mouseup']) {
      window.removeEventListener(type, shield, true)
    }
  }
  step.onLeave(release)
  fire('mousedown', separatorOf(root, id)!, at)
  const target = to(from)
  for (let i = 1; i <= 8; i++) {
    step.signal.throwIfAborted()
    at = from.x + ((target - from.x) * i) / 8
    fire('mousemove', document, at)
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
  return { release, at: () => at }
}

/** Протянуть ручку колонки так, чтобы колонка стала шириной `width`, и отпустить. */
export const dragGripTo = async (
  root: HTMLElement,
  step: StepRun,
  id: string,
  width: number,
) => {
  const head = gripOf(root, id)!.closest<HTMLElement>('[data-column-id]')!
  const current = head.getBoundingClientRect().width
  const held = await holdGrip(root, step, id, from => from.x + width - current)
  held.release()
}

const openMenu = () =>
  document.querySelector<HTMLElement>('[role="menu"][data-open]')

/** Открыть меню ручки нажатием на неё и выбрать пункт `item` (`data-item-id`). */
export const chooseGripItem = async (
  root: HTMLElement,
  step: StepRun,
  id: string,
  item: string,
) => {
  openMenuBy(() => gripOf(root, id), step.signal)
  const target = () =>
    openMenu()?.querySelector<HTMLElement>(
      `[role="menuitem"][data-item-id="${item}"]`,
    ) ?? null
  await pollUntil(() => !!target(), step.signal)
  // Пункт только что открытого меню нажатие принимает не сразу: нажатие повторяется, пока меню
  // не закроется; в живом Storybook гайд показывает одно нажатие и повтор не шлёт (SN46).
  while (openMenu()) {
    target()?.click()
    await sleep(150)
    step.signal.throwIfAborted()
  }
}
