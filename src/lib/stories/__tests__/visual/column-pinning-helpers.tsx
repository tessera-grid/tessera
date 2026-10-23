// Общие селекторы и хелперы наборов column-pinning (ADR 0011).
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expect } from 'vitest'
import { composed } from '../stories'
import { tableLabels } from '../labels'
import { PINNING_NESTED } from './header-fixtures'

export { composed }

// --- Selectors (part of the component contract) -------------------------------

/** Icon side per spec (`pinHeaderAction.tsx`: `<Icon width={16} height={16} />`). */
export const PIN_ICON_SIZE = 16

export const HEAD_CELL = '.data-grid__head-cell'
export const BODY_CELL = '.data-grid__body-cell'
/** ColumnPinning plugin's pin toggle, rendered per pinnable header. */
export const PIN_BUTTON = '.column-pin__button'
/** The element that actually overflows and scrolls. */
export const SCROLLER = '.data-grid__container'
/** A header cell of a real (non-action) data column. */
export const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`
/** A head cell currently pinned to the left edge. */
export const LEFT_PINNED_HEAD = `${HEAD_CELL}[data-cell-pinned='left']`
/** Head cells of the top (first) header row — top-level groups under nesting. */
export const FIRST_ROW_HEAD = `${HEAD_CELL}[data-first-headers-row='true']`
/** Head cells of the bottom (last) header row — the leaf headers under nesting. */
export const LAST_ROW_HEAD = `${HEAD_CELL}[data-last-headers-row='true']`
/** Leaf headers under a group: reach the bottom row but start below the top one. */
export const LEAF_UNDER_GROUP_HEAD = `${LAST_ROW_HEAD}:not([data-first-headers-row='true'])`

/** A head cell addressed by its column id (used for group/leaf headers). */
export const headCellById = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!

// --- Rendering / DOM helpers --------------------------------------------------

export type StoryArgs = Partial<
  Parameters<typeof composed.ColumnPinningPlayground>[0]
>

/** Render the ColumnPinning story and wait until its header cells are on screen. */
export async function renderColumnPinning(args: StoryArgs = {}) {
  const { container } = await render(
    <composed.ColumnPinningPlayground {...args} />,
  )
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/** The overflowing scroll container of the rendered grid. */
export const scrollerOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(SCROLLER)!

/** Render the nested-header pinning story and wait for its header rows. */
export async function renderHeaderGroupsPinning(args: StoryArgs = {}) {
  const { container } = await render(
    <composed.ColumnPinningPlayground {...PINNING_NESTED} {...args} />,
  )
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/**
 * Wait until `text` appears anywhere in the document (Base UI tooltips render
 * into a body portal after an open delay). A macrotask loop is used instead of
 * `expect.poll` because the tooltip's open timer needs real setTimeout ticks to
 * fire between checks.
 */
export const waitForBodyText = async (text: string, timeout = 3000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (document.body.textContent?.includes(text)) return true
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

/** Rendered data-column header cells, in visual (left-to-right) order. */
export const renderedDataCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(DATA_HEAD_CELL))
    // real columns carry aria-colindex; virtualization padding divs do not
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

/** The pin toggle inside a header cell. */
export const pinButtonOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(PIN_BUTTON)!

/**
 * The hover-hidden wrapper around a pin button. It carries `data-button-active`,
 * so we can find it structurally regardless of the (hashed) module class name;
 * it is the element `buttonVisibility.css` toggles opacity on.
 */
export const hiddenWrapperOf = (button: HTMLElement) =>
  button.closest<HTMLElement>('[data-button-active]')!

/** Reveal a cell's hover-hidden controls with a trusted pointer, return its pin. */
export const revealPin = async (cell: HTMLElement) => {
  await userEvent.hover(cell)
  // Наведение догружает модуль мини-меню, и заглушка кнопки сменяется настоящей
  // (ADR 0061) — кнопка перечитывается, а не берётся один раз.
  await expect
    .poll(() => getComputedStyle(hiddenWrapperOf(pinButtonOf(cell))).opacity)
    .toBe('1')
  return pinButtonOf(cell)
}

/** Pin the first data column to the left and wait until it becomes sticky. */
export const pinFirstColumn = async (container: HTMLElement) => {
  const cell = renderedDataCells(container)[0]
  const button = await revealPin(cell)
  await userEvent.click(button)
  await expect
    .poll(() => container.querySelector(LEFT_PINNED_HEAD) !== null)
    .toBe(true)
  return container.querySelector<HTMLElement>(LEFT_PINNED_HEAD)!
}

/** Menu items of the currently open pin popover / kebab (role=menuitem). */
export const menuItems = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))

export const menuItemByText = (text: string) =>
  menuItems().find(i => i.textContent?.trim() === text)

/**
 * Pin a `both`-sided header via its inline popover: reveal the pin button, click
 * it to open the mini-menu, then choose «Pin left» / «Pin right». One-sided
 * columns (`pinSides`) pin directly on button click — use `revealPin` there.
 */
export const pinViaPopover = async (cell: HTMLElement, item: string) => {
  const button = await revealPin(cell)
  await userEvent.click(button)
  await expect.poll(() => menuItemByText(item)).toBeTruthy()
  await userEvent.click(menuItemByText(item)!)
}

/** Run `body` in a viewport wider than the grid's columns (free space on the right). */
export const withWideViewport = async (body: () => Promise<void>) => {
  const { innerWidth, innerHeight } = window
  await page.viewport(1600, innerHeight)
  try {
    await body()
  } finally {
    await page.viewport(innerWidth, innerHeight)
  }
}

/**
 * Left edge and width of every body cell in the first row next to its leaf header
 * (`[left, width]`, px) — equal pairs mean header and body columns line up.
 */
export const headVsBodyColumns = (container: HTMLElement) => {
  const box = (el: Element | null) => {
    if (!el) return null
    const { left, width } = el.getBoundingClientRect()
    return [Math.round(left), Math.round(width)]
  }
  const row = container.querySelector('.data-grid__body-row')!
  return Array.from(row.querySelectorAll<HTMLElement>(BODY_CELL)).map(cell => {
    const id = cell.getAttribute('data-column-id')
    const heads = container.querySelectorAll(
      `${HEAD_CELL}[data-column-id='${id}']`,
    )
    return { id, head: box(heads[heads.length - 1]), body: box(cell) }
  })
}
