import { STORY_RENDERED } from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'
import { expect, userEvent, waitFor } from 'storybook/test'

// Помощники `play` историй-состояний каталога (ADR 0093, VR4–VR8): история доводит
// грид до состояния и заканчивается в покое — по нему каталог проверяет axe и
// Chromatic снимает снимок.

const LOAD_TIMEOUT = 5000

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Конечные анимации доиграны: снимок и axe не застают промежуточный кадр. */
export const settle = async () => {
  await new Promise(resolve => requestAnimationFrame(resolve))
  for (const animation of document.getAnimations()) {
    if (animation.effect?.getTiming().iterations !== Infinity) {
      animation.finish()
    }
  }
  await new Promise(resolve => requestAnimationFrame(resolve))
}

export const waitForRows = (canvas: HTMLElement) =>
  waitFor(
    () => expect(canvas.querySelector('.data-grid__body-row')).not.toBeNull(),
    { timeout: LOAD_TIMEOUT },
  )

export const headCell = (canvas: HTMLElement, column: string) =>
  canvas.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${column}"]`,
  )!

export const bodyRow = (canvas: HTMLElement, row: string) =>
  canvas.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"]`,
  )!

export const bodyCell = (canvas: HTMLElement, row: string, column: string) =>
  bodyRow(canvas, row).querySelector<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${column}"]`,
  )!

/** Класс аддона псевдо-состояний для состояния из `parameters.pseudo`. */
const PSEUDO_CLASS: Record<string, string> = {
  hover: 'pseudo-hover',
  focus: 'pseudo-focus',
  focusVisible: 'pseudo-focus-visible',
  active: 'pseudo-active',
}

/**
 * Псевдо-состояния на смонтированных узлах (ADR 0093, VR8). Аддон переписывает правила
 * по событию отрисовки истории — в проектах каталога его нет, поэтому оно шлётся здесь;
 * классы аддон ставит до того, как виртуализатор смонтирует строки, — их ставит `play`.
 */
export const applyPseudoStates = async (
  pseudo: Record<string, string | string[] | undefined>,
) => {
  addons.getChannel().emit(STORY_RENDERED)
  for (const [state, selectors] of Object.entries(pseudo)) {
    const className = PSEUDO_CLASS[state]
    if (!className || !selectors) continue
    for (const selector of [selectors].flat()) {
      for (const element of document.querySelectorAll(selector)) {
        element.classList.add(className)
      }
    }
  }
  await settle()
}

/** Ждёт открытый поповер с ролью и отдаёт его. */
export const waitForPopup = (role: string) =>
  waitFor(
    () => {
      const popup = document.querySelector<HTMLElement>(`[role="${role}"]`)
      expect(popup).not.toBeNull()
      return popup!
    },
    { timeout: LOAD_TIMEOUT },
  )

/**
 * Открывает меню или панель кнопкой: наведение грузит ленивый модуль (ADR 0061), клик
 * открывает уже загруженный — клик без наведения ждал бы загрузки в обход истории.
 */
export const openPopup = async (
  trigger: () => HTMLElement | null,
  role = 'dialog',
) => {
  // Кнопку ищем на каждой попытке: заглушку до загрузки модуля сменяет настоящая.
  await waitFor(() => expect(trigger()).not.toBeNull(), {
    timeout: LOAD_TIMEOUT,
  })
  await userEvent.hover(trigger()!)
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(300)
    if (document.querySelector(`[role="${role}"]`)) break
    const current = trigger()
    if (current && current.getAttribute('aria-expanded') !== 'true') {
      await userEvent.click(current)
    }
  }
  const popup = await waitForPopup(role)
  await settle()
  return popup
}

/** Открытый поповер целиком внутри холста истории (VR6). */
export const expectPopupInCanvas = (
  canvas: HTMLElement,
  popup: HTMLElement,
) => {
  const frame = canvas.firstElementChild!.getBoundingClientRect()
  const box = popup.getBoundingClientRect()
  expect(box.width).toBeGreaterThan(0)
  expect(box.top).toBeGreaterThanOrEqual(frame.top)
  expect(box.left).toBeGreaterThanOrEqual(frame.left)
  expect(box.bottom).toBeLessThanOrEqual(frame.bottom)
  expect(box.right).toBeLessThanOrEqual(frame.right)
}
