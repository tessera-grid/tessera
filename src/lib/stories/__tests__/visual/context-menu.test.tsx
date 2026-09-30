import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'
import { COLUMN_SELECTION_ID } from '../../../../lib/plugins/rowSelection'

// Каждое требование contextMenu — свой именованный тест `CM<n>` (ADR 0030).
// Гоняет историю `ContextMenu` (contextMenu + cellSelection). Меню портируется в
// document.body — читаем по `role="menu"`/`role="menuitem"`, не из container'а.

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

const centre = (el: Element) => {
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

const fireMouseAt = (el: Element, type: string, init: MouseEventInit = {}) => {
  const { x, y } = centre(el)
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    ...init,
  })
  el.dispatchEvent(event)
  return event
}

/** Left-button click that (de)selects a single cell. */
const leftClick = (el: Element, init: MouseEventInit = {}) => {
  fireMouseAt(el, 'mousedown', { button: 0, ...init })
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
}

/**
 * Realistic right-click: the browser fires `mousedown` (button 2) BEFORE
 * `contextmenu`. Returns the contextmenu event (for defaultPrevented).
 */
const rightClick = (el: Element) => {
  fireMouseAt(el, 'mousedown', { button: 2 })
  const event = fireMouseAt(el, 'contextmenu', { button: 2 })
  return event
}

const selectedCount = (container: HTMLElement) =>
  container.querySelectorAll(`${BODY_CELL}[data-cell-selected='true']`).length

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

  test('CM11: cellSelection contributes a "Copy" item to the menu', async () => {
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

  test('CM9: right-clicking inside a multi-selection preserves it (no reset)', async () => {
    const container = await renderContextMenu()
    // Multi-select a 2×2 block (rows 0–1 × cols 0–1).
    leftClick(cellAt(container, 0, 0))
    leftClick(cellAt(container, 1, 1), { shiftKey: true })
    await expect.poll(() => selectedCount(container)).toBe(4)

    // Right-click a cell INSIDE the selection — the preceding button-2 mousedown
    // must not reset the multi-selection.
    rightClick(cellAt(container, 1, 1))
    await expect.poll(() => menuEl()).not.toBeNull()
    expect(selectedCount(container)).toBe(4)
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

  test('CM10: right-click on a service column falls through to the native menu', async () => {
    // Service (selection) column is not selectable → no applicable item → native.
    const container = await renderContextMenu({ enableRowSelection: true })
    const serviceCell = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='${COLUMN_SELECTION_ID}']`,
    )
    expect(serviceCell).not.toBeNull()
    const event = rightClick(serviceCell!)
    expect(event.defaultPrevented).toBe(false)
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
