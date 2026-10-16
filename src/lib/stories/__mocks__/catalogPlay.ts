import type { Args } from '@storybook/react'
import {
  STORY_RENDERED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'
import { expect, userEvent, waitFor } from 'storybook/test'

import { PLAY_ARGS } from './catalog'

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

/** Ждёт, пока проверка пройдёт: задержки демо-«сервера» длиннее таймаута `waitFor`. */
export const until = <T>(check: () => T) =>
  waitFor(check, { timeout: LOAD_TIMEOUT })

export const waitForRows = (canvas: HTMLElement) =>
  until(() =>
    expect(canvas.querySelector('.data-grid__body-row')).not.toBeNull(),
  )

export const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

/** Текст журнала колбэков демо-истории. */
export const callbackLog = () => byTestId('callback-log')?.innerText ?? ''

/** Строки тела в порядке модели, а не монтирования. */
export const orderedRows = (canvas: HTMLElement) =>
  [...canvas.querySelectorAll<HTMLElement>('.data-grid__body-row')].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  )

/** Строка тела по индексу в модели. */
export const rowAt = (canvas: HTMLElement, index: number) =>
  canvas.querySelector<HTMLElement>(
    `.data-grid__body-row[data-index="${index}"]`,
  )!

/** Текст ячейки колонки в первой строке модели. */
export const firstRowText = (canvas: HTMLElement, column: string) =>
  orderedRows(canvas)[0]
    ?.querySelector(`[data-column-id="${column}"]`)
    ?.textContent?.trim()

/**
 * Меняет аргументы истории посреди `play`: живой Storybook и Chromatic обрабатывают
 * событие сами, в проектах каталога его слушает `PlayArgs` (`__mocks__/catalog.tsx`).
 */
export const updateArgs = async (storyId: string, updatedArgs: Args) => {
  const channel = addons.getChannel()
  channel.emit(UPDATE_STORY_ARGS, { storyId, updatedArgs })
  channel.emit(PLAY_ARGS, { storyId, updatedArgs })
  await settle()
}

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
 * в эффекте, который Storybook запускает событием отрисовки этой истории, — в проектах
 * каталога и в тестах его нет, поэтому оно шлётся здесь; классы аддон ставит до того,
 * как виртуализатор смонтирует строки, — их ставит `play`.
 */
export const applyPseudoStates = async (
  storyId: string,
  pseudo: Record<string, string | string[] | undefined>,
) => {
  addons.getChannel().emit(STORY_RENDERED, storyId)
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

/**
 * Шаг сценария (ADR 0117, §6): раскрыть панель сценария, нажать «Далее» и дождаться
 * смены шага — как человек. Переход на последний шаг выполняет и его (SN16).
 */
export const guideNext = async (canvas: HTMLElement) => {
  const panel = canvas.querySelector<HTMLElement>('[data-testid="guide"]')!
  const toggle = panel.querySelector<HTMLElement>(
    '[data-testid="guide-toggle"]',
  )!
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(toggle)
  }
  const next = panel.querySelector<HTMLButtonElement>(
    '[data-testid="guide-next"]',
  )!
  await until(() => expect(next).toBeEnabled())
  await userEvent.click(next)
  await until(() => expect(panel).not.toHaveAttribute('data-busy'))
}
