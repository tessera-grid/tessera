import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { ROW_ACTIONS_COLUMN_ID } from '../../../core/createColumns'
import * as stories from '../../DataGrid.stories'

// Every Column Pinning requirement is its own named test, prefixed with its spec
// ID (CP1–CP26 from the requirements table in docs/decisions/0011-column-pinning.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the canonical `ColumnPinning` story, sized to overflow on both axes
// so the sticky requirements (CP10–CP12) have real horizontal scroll distance.
// Synthetic input drives the mechanics; the two things it can't do — the CSS
// `:hover` reveal (CP5) and the Base UI tooltip (CP6) — use trusted browser input.

const composed = composeStories(stories)

// --- Selectors (part of the component contract) -------------------------------

/** Icon side per spec (`PinButton.tsx`: `<PinIcon width={16} height={16} />`). */
const PIN_ICON_SIZE = 16

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
/** ColumnPinning plugin's pin toggle, rendered per pinnable header. */
const PIN_BUTTON = '.column-pin__button'
/** The element that actually overflows and scrolls. */
const SCROLLER = '.MuiTableContainer-root'
/** A header cell of a real (non-action) data column. */
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`
/** A head cell currently pinned to the left edge. */
const LEFT_PINNED_HEAD = `${HEAD_CELL}[data-cell-pinned='left']`
/** Head cells of the top (first) header row — top-level groups under nesting. */
const FIRST_ROW_HEAD = `${HEAD_CELL}[data-first-headers-row='true']`
/** Head cells of the bottom (last) header row — the leaf headers under nesting. */
const LAST_ROW_HEAD = `${HEAD_CELL}[data-last-headers-row='true']`

/** A head cell addressed by its column id (used for group/leaf headers). */
const headCellById = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!

// --- Rendering / DOM helpers --------------------------------------------------

type StoryArgs = Partial<Parameters<typeof composed.ColumnPinning>[0]>

/** Render the ColumnPinning story and wait until its header cells are on screen. */
async function renderColumnPinning(args: StoryArgs = {}) {
  const { container } = await render(<composed.ColumnPinning {...args} />)
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/** The overflowing scroll container of the rendered grid. */
const scrollerOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(SCROLLER)!

/** Render the nested-header pinning story and wait for its header rows. */
async function renderHeaderGroupsPinning(args: StoryArgs = {}) {
  const { container } = await render(<composed.HeaderGroupsPinning {...args} />)
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
const waitForBodyText = async (text: string, timeout = 3000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (document.body.textContent?.includes(text)) return true
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

/** Rendered data-column header cells, in visual (left-to-right) order. */
const renderedDataCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(DATA_HEAD_CELL))
    // real columns carry aria-colindex; virtualization padding divs do not
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

/** The pin toggle inside a header cell. */
const pinButtonOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(PIN_BUTTON)!

/**
 * The hover-hidden wrapper around a pin button. It carries `data-button-active`,
 * so we can find it structurally regardless of the (hashed) module class name;
 * it is the element `buttonVisibility.css` toggles opacity on.
 */
const hiddenWrapperOf = (button: HTMLElement) =>
  button.closest<HTMLElement>('[data-button-active]')!

/** Reveal a cell's hover-hidden controls with a trusted pointer, return its pin. */
const revealPin = async (cell: HTMLElement) => {
  await userEvent.hover(cell)
  const button = pinButtonOf(cell)
  await expect
    .poll(() => getComputedStyle(hiddenWrapperOf(button)).opacity)
    .toBe('1')
  return button
}

/** Pin the first data column to the left and wait until it becomes sticky. */
const pinFirstColumn = async (container: HTMLElement) => {
  const cell = renderedDataCells(container)[0]
  const button = await revealPin(cell)
  await userEvent.click(button)
  await expect
    .poll(() => container.querySelector(LEFT_PINNED_HEAD) !== null)
    .toBe(true)
  return container.querySelector<HTMLElement>(LEFT_PINNED_HEAD)!
}

/** Menu items of the currently open pin popover / kebab (role=menuitem). */
const menuItems = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))

const menuItemByText = (text: string) =>
  menuItems().find(i => i.textContent?.trim() === text)

/**
 * Pin a `both`-sided header via its inline popover: reveal the pin button, click
 * it to open the mini-menu, then choose «Pin left» / «Pin right». One-sided
 * columns (`pinSides`) pin directly on button click — use `revealPin` there.
 */
const pinViaPopover = async (
  cell: HTMLElement,
  item: 'Pin left' | 'Pin right',
) => {
  const button = await revealPin(cell)
  await userEvent.click(button)
  await expect.poll(() => menuItemByText(item)).toBeTruthy()
  await userEvent.click(menuItemByText(item)!)
}

// --- Setup guard --------------------------------------------------------------
// Not a requirement itself; it protects the sticky requirements (CP10–CP12) from
// silently passing when the grid doesn't actually overflow horizontally.

describe('Column Pinning — setup guard', () => {
  test('ColumnPinning story overflows on both axes (feeds CP10–CP12)', async () => {
    const scroller = scrollerOf(await renderColumnPinning())
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  })
})

// --- Requirements (CP1–CP15) --------------------------------------------------

describe('Column Pinning — requirements', () => {
  test('CP1: the plugin is inert without `enableColumnPinning`', async () => {
    const container = await renderColumnPinning({ enableColumnPinning: false })
    // No affordance and nothing sticky when the feature is off.
    expect(container.querySelector(PIN_BUTTON)).toBeNull()
    expect(container.querySelector(LEFT_PINNED_HEAD)).toBeNull()
    expect(
      container.querySelector(`${BODY_CELL}[data-cell-pinned='left']`),
    ).toBeNull()
  })

  test('CP2: each pinnable data column gets a pin button in its header', async () => {
    const container = await renderColumnPinning()
    const dataCells = renderedDataCells(container)
    expect(dataCells.length).toBeGreaterThan(0)
    // Every rendered data column carries exactly one pin toggle.
    expect(
      container.querySelectorAll(`${DATA_HEAD_CELL} ${PIN_BUTTON}`).length,
    ).toBe(dataCells.length)
  })

  test('CP3: the pin icon is 16×16', async () => {
    const container = await renderColumnPinning()
    const svg = container.querySelector<HTMLElement>(`${PIN_BUTTON} svg`)!
    const style = getComputedStyle(svg)
    expect(style.width).toBe(`${PIN_ICON_SIZE}px`)
    expect(style.height).toBe(`${PIN_ICON_SIZE}px`)
  })

  test('CP4: the pin button is hidden (opacity 0) until the header is hovered', async () => {
    const container = await renderColumnPinning()
    // An unpinned column's toggle: hidden wrapper, not yet active.
    const button = pinButtonOf(renderedDataCells(container)[0])
    const wrapper = hiddenWrapperOf(button)
    expect(wrapper.getAttribute('data-button-active')).toBe('false')
    expect(getComputedStyle(wrapper).opacity).toBe('0')
  })

  test('CP5: the pin button is revealed on header hover', async () => {
    const container = await renderColumnPinning()
    const cell = renderedDataCells(container)[0]
    const wrapper = hiddenWrapperOf(pinButtonOf(cell))

    // Trusted hover (real pointer) triggers the CSS `:hover` reveal on the cell.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(wrapper).opacity).toBe('1')
  })

  test('CP6: the tooltip reads "pin" before pinning and "unpin" after', async () => {
    const container = await renderColumnPinning()
    const cell = renderedDataCells(container)[0]

    // Before pinning: hovering the cell then its trigger surfaces the
    // "Pin column" tooltip (Base UI renders the popup in a body portal after
    // its open delay).
    await userEvent.hover(cell)
    const button = pinButtonOf(cell)
    await userEvent.hover(button)
    expect(await waitForBodyText('Pin column')).toBe(true)

    // Pin it, then the same trigger's tooltip flips to "Unpin column".
    await userEvent.click(button)
    await expect
      .poll(() => container.querySelector(LEFT_PINNED_HEAD) !== null)
      .toBe(true)
    const pinnedButton = pinButtonOf(
      container.querySelector<HTMLElement>(LEFT_PINNED_HEAD)!,
    )
    // Move the pointer away first so re-hovering the (already-hovered) trigger
    // fires a fresh enter and re-opens the tooltip with its flipped label.
    await userEvent.hover(renderedDataCells(container)[3])
    await userEvent.hover(pinnedButton)
    expect(await waitForBodyText('Unpin column')).toBe(true)
  })

  test('CP7: clicking pins the column left; clicking again unpins it', async () => {
    const container = await renderColumnPinning()

    const pinnedCell = await pinFirstColumn(container)
    expect(pinnedCell.getAttribute('data-cell-pinned')).toBe('left')

    // The pinned button stays visible (data-button-active) — unpin with one click.
    await userEvent.click(pinButtonOf(pinnedCell))
    await expect
      .poll(() => container.querySelector(LEFT_PINNED_HEAD) === null)
      .toBe(true)
  })

  test('CP8: a pinned toggle highlights its icon with the accent colour, not a rotation', async () => {
    const container = await renderColumnPinning()
    const pinnedCell = await pinFirstColumn(container)
    const pinnedButton = pinButtonOf(pinnedCell)

    expect(
      hiddenWrapperOf(pinnedButton).getAttribute('data-button-active'),
    ).toBe('true')

    // The pinned toggle switches to `--tsr-comp-control-active-color`, so its
    // colour differs from an unpinned column's toggle…
    const plainCell = renderedDataCells(container).find(
      cell => cell.getAttribute('data-cell-pinned') !== 'left',
    )!
    const plainButton = await revealPin(plainCell)
    expect(getComputedStyle(pinnedButton).color).not.toBe(
      getComputedStyle(plainButton).color,
    )

    // …while the icon itself stays upright (no `rotate` transform).
    const svg = pinnedButton.querySelector<HTMLElement>('svg')!
    expect(getComputedStyle(svg).rotate).toBe('none')
  })

  test('CP9: toggling pin calls the `onTogglePin` hook with the new flag', async () => {
    const onTogglePin = vi.fn()
    const container = await renderColumnPinning({ onTogglePin })

    const pinnedCell = await pinFirstColumn(container)
    expect(onTogglePin).toHaveBeenLastCalledWith(true)

    await userEvent.click(pinButtonOf(pinnedCell))
    await expect.poll(() => onTogglePin).toHaveBeenLastCalledWith(false)
  })

  test('CP10: a pinned cell is position:sticky offset by getStart("left")', async () => {
    const container = await renderColumnPinning()
    await pinFirstColumn(container)

    // Both the header and the body cells of the pinned column go sticky.
    const headCell = container.querySelector<HTMLElement>(LEFT_PINNED_HEAD)!
    const bodyCell = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-cell-pinned='left']`,
    )!
    expect(getComputedStyle(headCell).position).toBe('sticky')
    expect(getComputedStyle(bodyCell).position).toBe('sticky')
    // First pinned column sits flush at the left edge (getStart('left') === 0).
    expect(getComputedStyle(headCell).left).toBe('0px')
    expect(getComputedStyle(bodyCell).left).toBe('0px')
  })

  test('CP11: a pinned cell keeps a background and stays put while scrolling', async () => {
    const container = await renderColumnPinning()
    await pinFirstColumn(container)
    const scroller = scrollerOf(container)
    const bodyCell = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-cell-pinned='left']`,
    )!

    // A pinned cell paints an opaque background so scrolled content can't bleed
    // through, and carries the pinned stacking layer. Its background-color
    // transitions in, so poll until it settles to an opaque colour.
    await expect
      .poll(() => {
        const bg = getComputedStyle(bodyCell).backgroundColor
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      })
      .toBe(true)
    expect(Number(getComputedStyle(bodyCell).zIndex)).toBeGreaterThan(0)

    // It stays glued to the left edge across a horizontal scroll.
    const leftBefore = bodyCell.getBoundingClientRect().left
    scroller.scrollLeft = Math.min(
      600,
      scroller.scrollWidth - scroller.clientWidth,
    )
    await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(0)
    expect(
      Math.abs(bodyCell.getBoundingClientRect().left - leftBefore),
    ).toBeLessThan(2)
  })

  test('CP12: the last left-pinned column carries a right divider border', async () => {
    const container = await renderColumnPinning()
    const pinnedCell = await pinFirstColumn(container)

    // Only one left-pinned column → it is the last one, so it gets the border.
    expect(pinnedCell.getAttribute('data-cell-last-left-pinned')).toBe('true')
    const border = getComputedStyle(pinnedCell).borderRightWidth
    expect(parseFloat(border)).toBeGreaterThan(0)
  })

  test('CP13: under nested headers a leaf under a group is not individually pinnable', async () => {
    const container = await renderHeaderGroupsPinning()
    // Leaf headers live in the last header row — none of them carries a pin
    // toggle: only whole top-level groups are pinnable.
    expect(container.querySelectorAll(HEAD_CELL).length).toBeGreaterThan(1)
    expect(container.querySelector(`${LAST_ROW_HEAD} ${PIN_BUTTON}`)).toBeNull()
  })

  test('CP16: enabling the plugin after mount reveals top-level group pinning under nested headers (matches a fresh mount)', async () => {
    // Regression: the plugin's `feature.createColumn` wraps `getCanPin` to scope
    // pinning to top-level groups under nested headers (CP17). TanStack freezes
    // `_features` at `createTable` (useReactTable never rebuilds the table), so a
    // feature absent at mount never appears on a live toggle. The registry keeps
    // the pinning feature in `_features` even while disabled (inert until
    // `enableColumnPinning`), so a live toggle matches a fresh mount — the top
    // group buttons appear, and leaf headers stay button-free.
    const { container, rerender } = await render(
      <composed.HeaderGroupsPinning enableColumnPinning={false} />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(1)
    // Disabled: no toggles yet.
    expect(container.querySelector(PIN_BUTTON)).toBeNull()

    // Toggle the plugin on without a remount — top-level group headers reveal
    // their pin toggle (as a fresh mount would), leaves stay button-free.
    await rerender(<composed.HeaderGroupsPinning enableColumnPinning />)
    await expect
      .poll(() => container.querySelector(PIN_BUTTON) !== null)
      .toBe(true)
    expect(container.querySelector(`${LAST_ROW_HEAD} ${PIN_BUTTON}`)).toBeNull()
  })

  test('CP17: under nested headers only top-level group headers get a pin button', async () => {
    const container = await renderHeaderGroupsPinning()
    const buttons = Array.from(
      container.querySelectorAll<HTMLElement>(PIN_BUTTON),
    )
    // There are pin toggles…
    expect(buttons.length).toBeGreaterThan(0)
    // …every one of them lives in a top (first-row) header cell…
    expect(buttons.every(btn => btn.closest(FIRST_ROW_HEAD) !== null)).toBe(
      true,
    )
    // …and none in the leaf (last) header row.
    expect(container.querySelector(`${LAST_ROW_HEAD} ${PIN_BUTTON}`)).toBeNull()
  })

  test('CP18: clicking a top-level group toggle pins the whole group (all its leaves)', async () => {
    const container = await renderHeaderGroupsPinning()
    // The `name` group spans the firstName + lastName leaves (see the mock).
    // Group headers default to `both` sides → pin via the inline popover.
    const nameGroup = headCellById(container, 'name')
    await pinViaPopover(nameGroup, 'Pin left')

    // The group header itself goes sticky-left…
    await expect
      .poll(() =>
        headCellById(container, 'name').getAttribute('data-cell-pinned'),
      )
      .toBe('left')

    // …and every leaf of the group is left-pinned in the body.
    for (const leaf of ['firstName', 'lastName']) {
      // eslint-disable-next-line no-await-in-loop
      await expect
        .poll(
          () =>
            container.querySelector(
              `${BODY_CELL}[data-column-id='${leaf}'][data-cell-pinned='left']`,
            ) !== null,
        )
        .toBe(true)
    }
  })

  test('CP19: a pinned group and its leaves stick to the left edge with the correct offset', async () => {
    const container = await renderHeaderGroupsPinning()
    const nameGroup = headCellById(container, 'name')
    await pinViaPopover(nameGroup, 'Pin left')
    await expect
      .poll(() =>
        headCellById(container, 'name').getAttribute('data-cell-pinned'),
      )
      .toBe('left')

    // The group is the only left-pinned block, so its first leaf sits flush at
    // the edge → the group header AND that leaf's body cell are sticky at 0px.
    const groupHead = headCellById(container, 'name')
    const firstLeafBody = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName']`,
    )!
    expect(getComputedStyle(groupHead).position).toBe('sticky')
    expect(getComputedStyle(groupHead).left).toBe('0px')
    expect(getComputedStyle(firstLeafBody).position).toBe('sticky')
    expect(getComputedStyle(firstLeafBody).left).toBe('0px')
  })

  test('CP14: the row-actions column is auto-pinned right without any click', async () => {
    const container = await renderColumnPinning({
      enableRowSelection: true,
      enableRowActions: true,
      columnCount: 5,
    })

    // The trailing row-actions service column is auto-pinned to the right from
    // the start (no user interaction).
    const actionPins = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-actions-column-cell='true']`,
        ),
      ).map(cell => cell.getAttribute('data-cell-pinned'))
    await expect.poll(() => actionPins()).toContain('right')
  })

  test('CP14b: leading service columns follow the pinned block once a column is pinned left', async () => {
    const container = await renderColumnPinning({
      enableRowSelection: true,
      enableRowActions: true,
      columnCount: 5,
    })

    const leadingServicePins = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-actions-column-cell='true']`,
        ),
      )
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )[0]
        ?.getAttribute('data-cell-pinned')

    // Before any user pin, the leading service column is not left-pinned…
    expect(leadingServicePins()).not.toBe('left')

    // …but once the user pins a data column left, the leading service column
    // joins the left-pinned block (merge logic in useCreateState).
    await pinFirstColumn(container)
    await expect.poll(() => leadingServicePins()).toBe('left')
  })

  test('CP14c: unpinning the last user column releases leading service columns (pin.when=with-user)', async () => {
    const container = await renderColumnPinning({
      enableRowSelection: true,
      enableRowActions: true,
      columnCount: 5,
    })

    const leadingServicePin = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-actions-column-cell='true']`,
        ),
      )
        .sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )[0]
        ?.getAttribute('data-cell-pinned')

    // Pin a data column left → the leading service column joins the left block…
    await pinFirstColumn(container)
    await expect.poll(() => leadingServicePin()).toBe('left')

    // …unpin it → with no user pins left, the leading service column releases
    // (proves service ids don't leak into the stored user pinning and keep it
    // stuck — `when: 'with-user'` is evaluated on real user pins only). Re-query
    // the data column's pin toggle fresh — the node re-rendered above (the
    // service column carries no toggle: enablePinning=false).
    const dataPinButton = container.querySelector<HTMLElement>(
      `${LEFT_PINNED_HEAD} ${PIN_BUTTON}`,
    )!
    await userEvent.click(dataPinButton)
    await expect.poll(() => leadingServicePin()).not.toBe('left')
  })

  test('CP15: a pinned column cannot be dragged — covered by column-dragging D29', () => {
    // The pinned-column-not-draggable guarantee is exercised where dragging lives:
    // see `column-dragging.test.tsx` → D29 (docs/decisions/0006-dnd-with-dnd-kit.md).
    // Kept as a named marker so CP15 shows up in the requirement roll-call.
    expect(true).toBe(true)
  })

  test('CP20: a both-sided column opens a pin popover; a one-sided column toggles directly', async () => {
    const container = await renderColumnPinning()

    // `firstName` allows both sides (default) → its inline pin is a popover with
    // two directional items, and clicking the trigger does not pin on its own.
    const both = headCellById(container, 'firstName')
    await userEvent.click(await revealPin(both))
    await expect.poll(() => menuItemByText('Pin left')).toBeTruthy()
    expect(menuItemByText('Pin right')).toBeTruthy()
    expect(both.getAttribute('data-cell-pinned')).toBe('false')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => menuItems().length).toBe(0)

    // `country` is `pinSides:'left'` (see the mock) → the inline pin is a direct
    // toggle: clicking it pins left with no popover.
    const oneSide = headCellById(container, 'country')
    await userEvent.click(await revealPin(oneSide))
    await expect
      .poll(() =>
        headCellById(container, 'country').getAttribute('data-cell-pinned'),
      )
      .toBe('left')
    expect(menuItems().length).toBe(0)
  })

  test('CP21: choosing "Pin right" sticks the column to the right edge (mounted at scroll 0)', async () => {
    const container = await renderColumnPinning()

    // Pin a both-sided column right via the popover. It must render sticky at the
    // right edge immediately — without scrolling — even under column virtualization
    // (the range extractor re-windows on the pinning change).
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')

    const rightHead = () =>
      container.querySelector<HTMLElement>(
        `${HEAD_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
      )
    await expect.poll(() => rightHead() !== null).toBe(true)
    const head = rightHead()!
    expect(getComputedStyle(head).position).toBe('sticky')
    // Only right-pinned column → flush at the right edge (getAfter('right') === 0).
    expect(getComputedStyle(head).right).toBe('0px')
    // Its body cell mounts and is sticky too (proves it left the virtual window
    // yet stays pinned).
    const body = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
    )!
    expect(body).toBeTruthy()
    expect(getComputedStyle(body).position).toBe('sticky')
  })

  test('CP22: a right-pinned column keeps a background and a left divider border', async () => {
    const container = await renderColumnPinning()
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')

    const body = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
    )!
    // Opaque background so scrolled content can't bleed through (mirror of left).
    await expect
      .poll(() => {
        const bg = getComputedStyle(body).backgroundColor
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      })
      .toBe(true)
    // The first (leftmost) right-pinned column carries the divider on its left.
    expect(body.getAttribute('data-cell-first-right-pinned')).toBe('true')
    expect(parseFloat(getComputedStyle(body).borderLeftWidth)).toBeGreaterThan(
      0,
    )
  })

  // --- Row-actions column (CP23–CP25) ----------------------------------------
  // The trailing row-actions service column is auto-pinned right (CP14). These
  // pin down how it looks in the two-sided world: transparent by default, but
  // adopting the pinned backing once the user pins a data column right.

  /** The auto-pinned row-actions column body/head cells. */
  const actionsBody = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='${ROW_ACTIONS_COLUMN_ID}']`,
    )!
  const actionsHead = (container: HTMLElement) =>
    container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-column-id='${ROW_ACTIONS_COLUMN_ID}']`,
    )!
  /** A cell paints an opaque (non-transparent) background. */
  const isOpaque = (el: HTMLElement) => {
    const bg = getComputedStyle(el).backgroundColor
    return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
  }

  test('CP23: the row-actions column is transparent by default but adopts the pinned backing once a column is pinned right', async () => {
    const container = await renderColumnPinning({ enableRowActions: true })

    // Auto-pinned right (CP14) yet the SOLE right column → first-right, no backing.
    await expect
      .poll(() => actionsBody(container).getAttribute('data-cell-pinned'))
      .toBe('right')
    expect(
      actionsBody(container).getAttribute('data-cell-first-right-pinned'),
    ).toBe('true')
    expect(isOpaque(actionsBody(container))).toBe(false)

    // Pin a both-sided data column right → row-actions is no longer first-right
    // and joins the pinned block with the same backing (body).
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')
    await expect
      .poll(() =>
        actionsBody(container).getAttribute('data-cell-first-right-pinned'),
      )
      .toBe('false')
    await expect.poll(() => isOpaque(actionsBody(container))).toBe(true)

    // Its header adopts the backing too — sticky, aligned with its body, and with
    // no content (the row-actions header is empty by design).
    const head = actionsHead(container)
    expect(isOpaque(head)).toBe(true)
    expect(getComputedStyle(head).position).toBe('sticky')
    expect(head.textContent).toBe('')
    expect(Math.round(head.getBoundingClientRect().left)).toBe(
      Math.round(actionsBody(container).getBoundingClientRect().left),
    )
  })

  test('CP24: a user right-pin sits left of the row-actions column, which never carries a divider', async () => {
    const container = await renderColumnPinning({ enableRowActions: true })
    await pinViaPopover(headCellById(container, 'firstName'), 'Pin right')

    const userPin = container.querySelector<HTMLElement>(
      `${BODY_CELL}[data-column-id='firstName'][data-cell-pinned='right']`,
    )!
    const actions = actionsBody(container)

    // User right-pin is to the LEFT of the trailing row-actions column.
    await expect
      .poll(() => userPin.getBoundingClientRect().left)
      .toBeLessThan(actions.getBoundingClientRect().left)

    // The user column is first in the right block → it carries the divider;
    // the row-actions column never does (even though it is right-pinned).
    expect(userPin.getAttribute('data-cell-first-right-pinned')).toBe('true')
    expect(
      parseFloat(getComputedStyle(userPin).borderLeftWidth),
    ).toBeGreaterThan(0)
    expect(parseFloat(getComputedStyle(actions).borderLeftWidth)).toBe(0)
  })

  test('CP25: row-action buttons keep an opaque chip so they read over scrolled content', async () => {
    const container = await renderColumnPinning({ enableRowActions: true })

    // The row-actions column is sticky and transparent, so scrolled content can
    // pass under it; each row-action button must stay an opaque chip (background
    // + elevation) to remain legible. Buttons live in the row-actions cell,
    // revealed on row hover.
    const row = container.querySelector<HTMLElement>('.data-grid__body-row')!
    await userEvent.hover(row)
    const button = actionsBody(container).querySelector<HTMLElement>(
      '.row__button button',
    )!
    expect(button).toBeTruthy()
    expect(isOpaque(button)).toBe(true)
    expect(getComputedStyle(button).boxShadow).not.toBe('none')
  })

  // --- Virtualization order (CP26) ----------------------------------------------

  test('CP26: center columns stay contiguous after right-pinning a column of a different width', async () => {
    // 20 равных столбцов, кроме c5 (400px, закрепляемый только вправо). Закрепление
    // уносит c5 в конец порядка отображения; виртуализатор обязан размечать слоты в
    // том же порядке, иначе ширина c5 ляжет в слот c6 и центр «разъедется».
    const columns = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      accessorKey: `c${i}`,
      header: `C${i}`,
      size: i === 5 ? 400 : 150,
      enablePinning: true,
      ...(i === 5 ? { meta: { pinSides: 'right' } } : {}),
    }))
    const container = await renderColumnPinning({ columnsOverride: columns })

    await userEvent.click(await revealPin(headCellById(container, 'c5')))
    await expect
      .poll(
        () =>
          container.querySelector(
            `${HEAD_CELL}[data-column-id='c5'][data-cell-pinned='right']`,
          ) !== null,
      )
      .toBe(true)

    const centerHeads = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          `${HEAD_CELL}[data-virtual-cell]`,
        ),
      ).sort(
        (a, b) =>
          a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      )
    /** Зазор между каждым центральным заголовком и его левым соседом, px. */
    const gaps = () => {
      const rects = centerHeads().map(head => head.getBoundingClientRect())
      return rects
        .slice(1)
        .map((rect, i) => Math.round(rect.left - rects[i].right))
    }

    // Окно содержит соседей бывшей позиции c5 — именно там разъезжался бы центр.
    await expect
      .poll(() =>
        centerHeads().map(head => head.getAttribute('data-column-id')),
      )
      .toEqual(expect.arrayContaining(['c4', 'c6', 'c7']))
    await expect.poll(() => gaps().every(gap => Math.abs(gap) <= 1)).toBe(true)
  })
})
