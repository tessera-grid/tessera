import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'
import { waitForGrid } from './core-helpers'

// Сочетания по платформе (ADR 0232, KX12–KX13): настоящие клавиши Playwright, платформа —
// опцией `keyboardPlatform`.

type Platform = 'apple' | 'other'

const BODY_ROW = '.data-grid__body-row'

const active = () => document.activeElement as HTMLElement
const columnOfActive = () => Number(active().getAttribute('aria-colindex'))
const rowOfActive = () =>
  Number(active().closest('[role="row"]')?.getAttribute('aria-rowindex'))
const cellAt = (index: number, column: string) =>
  document.querySelector<HTMLElement>(
    `${BODY_ROW}[data-index='${index}'] [data-column-id='${column}']`,
  )!
const titleOf = (cell: HTMLElement) =>
  cell.querySelector('.data-grid__cell-wrapper-title')?.textContent?.trim() ??
  ''
const menu = () => document.querySelector('[role="menu"]')
const colCount = () =>
  Number(
    document
      .querySelector('[role="grid"], [role="treegrid"]')!
      .getAttribute('aria-colcount'),
  )

const mount = async (platform: Platform) => {
  const screen = await render(
    <composed.DataGridPlayground
      keyboardPlatform={platform}
      enableKeyboardNavigation
      enableCellEditing
      enableCellSelection
      enableContextMenu
      enableEditHistory
      columnCount={6}
      dataCount={40}
      containerHeight="520"
      height="480"
    />,
  )
  await waitForGrid()
  return screen
}

/** Фокус на ячейке с клавиатурным признаком: шаг стрелкой и обратно. */
const focusCell = async (index: number, column: string) => {
  cellAt(index, column).focus()
  await userEvent.keyboard('{ArrowRight}{ArrowLeft}')
  await expect.poll(() => active().getAttribute('data-column-id')).toBe(column)
}

const closeMenu = async () => {
  await userEvent.keyboard('{Escape}')
  await expect.poll(menu).toBeNull()
}

describe('Сочетания по платформе (ADR 0232)', () => {
  test('KX12: замены клавиш по таблице платформ: на Apple — `Cmd+←/→`, `Option+↑/↓`, `Enter`, `Backspace`, `Cmd+Shift+Enter`; на остальных — прежние клавиши', async () => {
    // Apple.
    const screen = await mount('apple')
    await focusCell(3, 'firstName')
    await userEvent.keyboard('{Meta>}{ArrowRight}{/Meta}')
    await expect.poll(columnOfActive).toBe(colCount())
    await userEvent.keyboard('{Meta>}{ArrowLeft}{/Meta}')
    await expect.poll(columnOfActive).toBe(1)
    // Ctrl на Apple — не навигация.
    await focusCell(3, 'firstName')
    const column = columnOfActive()
    await userEvent.keyboard('{Control>}{ArrowRight}{/Control}')
    expect(columnOfActive()).toBe(column)
    const row = rowOfActive()
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await expect.poll(rowOfActive).toBeGreaterThan(row + 1)
    // Enter вместо F2 открывает правку.
    await focusCell(2, 'age')
    await userEvent.keyboard('{Enter}')
    await expect
      .poll(() => cellAt(2, 'age').querySelector('input'))
      .not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => cellAt(2, 'age').querySelector('input')).toBeNull()
    // Backspace вместо Delete очищает выделенную ячейку.
    await focusCell(2, 'age')
    expect(titleOf(cellAt(2, 'age'))).not.toBe('')
    await userEvent.keyboard('{Backspace}')
    await expect.poll(() => titleOf(cellAt(2, 'age'))).toBe('')
    // Cmd+Shift+Enter вместо Shift+F10.
    await focusCell(4, 'firstName')
    await userEvent.keyboard('{Meta>}{Shift>}{Enter}{/Shift}{/Meta}')
    await expect.poll(menu).not.toBeNull()
    await closeMenu()
    await focusCell(4, 'firstName')
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}')
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(menu(), 'Ctrl+Shift+Enter на Apple меню не открывает').toBeNull()
    await screen.unmount()

    // Остальные платформы.
    await mount('other')
    await focusCell(3, 'firstName')
    await userEvent.keyboard('{End}')
    await expect.poll(columnOfActive).toBe(colCount())
    await userEvent.keyboard('{Home}')
    await expect.poll(columnOfActive).toBe(1)
    await userEvent.keyboard('{Control>}{ArrowRight}{/Control}')
    await expect.poll(columnOfActive).toBe(colCount())
    await focusCell(3, 'firstName')
    const start = columnOfActive()
    await userEvent.keyboard('{Meta>}{ArrowRight}{/Meta}')
    expect(columnOfActive(), 'Win+→ — не навигация').toBe(start)
    const top = rowOfActive()
    await userEvent.keyboard('{PageDown}')
    await expect.poll(rowOfActive).toBeGreaterThan(top + 1)
    await focusCell(2, 'age')
    await userEvent.keyboard('{F2}')
    await expect
      .poll(() => cellAt(2, 'age').querySelector('input'))
      .not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => cellAt(2, 'age').querySelector('input')).toBeNull()
    await focusCell(2, 'age')
    await userEvent.keyboard('{Delete}')
    await expect.poll(() => titleOf(cellAt(2, 'age'))).toBe('')
    await focusCell(4, 'firstName')
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    await expect.poll(menu).not.toBeNull()
    await closeMenu()
    await focusCell(4, 'firstName')
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}')
    await expect.poll(menu).not.toBeNull()
    await closeMenu()
  })

  test('KX13: повтор: на Apple — `Cmd+Shift+Z`; на остальных — `Ctrl+Y` и `Ctrl+Shift+Z`', async () => {
    /** Правка возраста строки 2 на `value` и шаг назад к прежнему значению. */
    const editAndUndo = async (value: string, undo: string) => {
      await focusCell(2, 'age')
      const before = titleOf(cellAt(2, 'age'))
      await userEvent.keyboard('{Enter}')
      const input = () => cellAt(2, 'age').querySelector('input')!
      await expect.poll(input).not.toBeNull()
      await userEvent.fill(input(), value)
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => titleOf(cellAt(2, 'age'))).toBe(value)
      await focusCell(2, 'age')
      await userEvent.keyboard(undo)
      await expect.poll(() => titleOf(cellAt(2, 'age'))).toBe(before)
    }
    const age = () => titleOf(cellAt(2, 'age'))
    const pause = () => new Promise(resolve => setTimeout(resolve, 300))

    const screen = await mount('apple')
    await editAndUndo('71', '{Meta>}z{/Meta}')
    const restored = age()
    await userEvent.keyboard('{Meta>}y{/Meta}')
    await pause()
    expect(age(), 'Cmd+Y на Apple не повторяет').toBe(restored)
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await pause()
    expect(age(), 'Ctrl+Shift+Z на Apple не повторяет').toBe(restored)
    await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}')
    await expect.poll(age).toBe('71')
    // Ctrl+Z на Apple не отменяет.
    await userEvent.keyboard('{Control>}z{/Control}')
    await pause()
    expect(age()).toBe('71')
    await screen.unmount()

    await mount('other')
    await editAndUndo('72', '{Control>}z{/Control}')
    await userEvent.keyboard('{Control>}y{/Control}')
    await expect.poll(age).toBe('72')
    await userEvent.keyboard('{Control>}z{/Control}')
    await expect.poll(age).not.toBe('72')
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await expect.poll(age).toBe('72')
    // Win+Z на остальных не отменяет.
    await userEvent.keyboard('{Meta>}z{/Meta}')
    await pause()
    expect(age()).toBe('72')
  })
})
