import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'

// Каждое требование contextMenu — свой именованный тест `CM<n>` (ADR 0030).
// Гоняет историю `ContextMenu` (contextMenu + cellSelection). Меню портируется в
// document.body — читаем по `role="menu"`/`role="menuitem"`, не из container'а.

const composed = composeStories(stories)

const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'

const rowsTopDown = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(BODY_ROW))
    .filter(row => row.getAttribute('data-index') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )

const cellsLeftRight = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLElement>(BODY_CELL))
    .filter(c => c.getAttribute('data-column-id'))
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

const cellAt = (container: HTMLElement, r: number, c: number) =>
  cellsLeftRight(rowsTopDown(container)[r])[c]

/** Dispatch a right-click at the element's centre; returns the event (for defaultPrevented). */
const rightClick = (el: Element) => {
  const rect = el.getBoundingClientRect()
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  })
  el.dispatchEvent(event)
  return event
}

const menuEl = () => document.querySelector('[role="menu"]')
const menuItems = () =>
  Array.from(document.querySelectorAll('[role="menuitem"]')).map(i =>
    i.textContent?.trim(),
  )

type ContextMenuArgs = Partial<Parameters<typeof composed.ContextMenu>[0]>

async function renderContextMenu(args: ContextMenuArgs = {}) {
  const { container } = await render(<composed.ContextMenu {...args} />)
  await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(3)
  return container
}

describe('Context Menu', () => {
  test('CM2: right-click opens a menu and suppresses the native one', async () => {
    const container = await renderContextMenu()
    const event = rightClick(cellAt(container, 1, 0))
    expect(event.defaultPrevented).toBe(true)
    await expect.poll(() => menuEl()).not.toBeNull()
  })

  test('CM1: cellSelection contributes a "Copy" item to the menu', async () => {
    const container = await renderContextMenu()
    rightClick(cellAt(container, 1, 0))
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    expect(menuItems()).toContain('Copy')
  })

  test('CM7: right-clicking a non-selected cell selects it first', async () => {
    const container = await renderContextMenu()
    const cell = cellAt(container, 4, 2)
    expect(cell.getAttribute('data-cell-selected')).toBeNull()
    rightClick(cell)
    await expect
      .poll(() => cellAt(container, 4, 2).getAttribute('data-cell-selected'))
      .toBe('true')
    expect(menuEl()).not.toBeNull()
  })

  test('CM6: Escape closes the menu', async () => {
    const container = await renderContextMenu()
    rightClick(cellAt(container, 1, 0))
    await expect.poll(() => menuEl()).not.toBeNull()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await expect.poll(() => menuEl()).toBeNull()
  })

  test('CM5: with the surface on but no contributing plugin, no menu opens', async () => {
    // contextMenu enabled, cellSelection off → zero applicable items → native menu.
    const container = await renderContextMenu({ enableCellSelection: false })
    const event = rightClick(cellAt(container, 1, 0))
    expect(event.defaultPrevented).toBe(false)
    // Give a lazy popup no chance to appear.
    await new Promise(r => setTimeout(r, 200))
    expect(menuEl()).toBeNull()
  })

  test('CM8: without the contextMenu plugin the native menu is used (inert)', async () => {
    const container = await renderContextMenu({ enableContextMenu: false })
    const event = rightClick(cellAt(container, 1, 0))
    expect(event.defaultPrevented).toBe(false)
    await new Promise(r => setTimeout(r, 200))
    expect(menuEl()).toBeNull()
  })
})
