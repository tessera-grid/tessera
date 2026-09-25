import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'

// Соответствие WCAG 2.1.1: каждое требование — свой именованный тест `KB<n>`
// (таблица требований в docs/decisions/0031-wcag-keyboard.md). Ввод — реальные
// CDP-клавиши, состояние читается из DOM и вычисленных стилей.

const composed = composeStories(stories)

const HEAD_CELL = '.data-grid__head-cell'
const HIDDEN_BUTTON = '.cell__button--hidden'

const active = () => document.activeElement as HTMLElement
const press = (keys: string) => userEvent.keyboard(keys)
const opacityOf = (cell: Element) =>
  getComputedStyle(cell.querySelector(HIDDEN_BUTTON)!).opacity

/** Грид после внешней кнопки: вход в грид по Tab, указатель — вне грида. */
async function renderFromOutside() {
  await render(
    <>
      <button id="before-grid">before</button>
      <composed.KeyboardNavigation />
    </>,
  )
  await expect
    .poll(
      () => document.querySelectorAll(`${HEAD_CELL} ${HIDDEN_BUTTON}`).length,
    )
    .toBeGreaterThan(1)
  const before = document.getElementById('before-grid')!
  await userEvent.hover(before)
  before.focus()
}

describe('WCAG 2.1.1 (Keyboard)', () => {
  test('KB1: hover-кнопки видимы при клавиатурном фокусе на ячейке и на самой кнопке', async () => {
    await renderFromOutside()

    // Вход по Tab, затем вверх в строку заголовков (кламп на ней).
    await press('{Tab}{ArrowUp}{ArrowUp}')
    await expect.poll(() => active().getAttribute('role')).toBe('columnheader')
    for (let i = 0; i < 10 && !active().querySelector(HIDDEN_BUTTON); i++) {
      await press('{ArrowRight}')
    }
    const cell = active()
    expect(cell.querySelector(HIDDEN_BUTTON)).not.toBeNull()

    await expect.poll(() => opacityOf(cell)).toBe('1')
    const neighbour = Array.from(
      document.querySelectorAll<HTMLElement>(HEAD_CELL),
    ).find(other => other !== cell && other.querySelector(HIDDEN_BUTTON))!
    expect(opacityOf(neighbour)).toBe('0')

    // Режим действия (F2: Enter на заголовке — сортировка): фокус на кнопке
    // внутри ячейки — кнопка остаётся видимой.
    await press('{F2}')
    await expect
      .poll(() => cell.contains(active()) && active() !== cell)
      .toBe(true)
    await expect.poll(() => opacityOf(cell)).toBe('1')

    await press('{Escape}')
    await expect.poll(() => active()).toBe(cell)
  })
})
