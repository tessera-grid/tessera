import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import * as stories from '../../DataGrid.stories'

// Every Column Resizing requirement is its own named test, prefixed with its spec
// ID (CR1–CR15 from the requirements table in docs/decisions/0013-column-sizing.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the canonical `ColumnResizing` story. The leftmost data column is
// resized so there is always room to the right to drag into. Synthetic mouse
// events drive the TanStack resize handler (mousedown on the grip → mousemove on
// document → mouseup); the one thing they can't do — the CSS `:hover` reveal
// (CR5) — uses trusted browser input.

const composed = composeStories(stories)

// --- Selectors (part of the component contract) -------------------------------

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
/** ColumnSizing plugin's resize grip, rendered per resizable header. */
const RESIZE_GRIP = '.resize__handler--column'
/** A header cell of a real (non-action) data column. */
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`

// --- Rendering / DOM helpers --------------------------------------------------

type StoryArgs = Partial<Parameters<typeof composed.ColumnResizing>[0]>

/** Render the ColumnResizing story and wait until its header cells are on screen. */
async function renderColumnResizing(args: StoryArgs = {}) {
  const { container } = await render(<composed.ColumnResizing {...args} />)
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/** Rendered data-column header cells, in visual (left-to-right) order. */
const renderedDataCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(DATA_HEAD_CELL))
    // real columns carry aria-colindex; virtualization padding divs do not
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

/** The leftmost rendered data column (always has room to grow to the right). */
const firstDataCell = (container: HTMLElement) => renderedDataCells(container)[0]

/** The resize grip inside a header cell. */
const gripOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(RESIZE_GRIP)!

/**
 * The hover-hidden wrapper carrying `data-button-active` — the element
 * `buttonVisibility.css` toggles opacity on. The grip's outer div is itself the
 * wrapper (`cell__button cell__button--hidden`), found structurally regardless of
 * the hashed module class name.
 */
const wrapperOf = (grip: HTMLElement) =>
  grip.closest<HTMLElement>('[data-button-active]')!

/** Rendered width (px) of a cell — the column width applied via `--col-<id>-size`. */
const widthOf = (cell: HTMLElement) => cell.getBoundingClientRect().width

/** The `aria-colindex` of a header cell as a selector-ready string. */
const colIndexOf = (cell: HTMLElement) => cell.getAttribute('aria-colindex')!

/** A rendered body cell of the column at `colIndex`. */
const bodyCellAt = (container: HTMLElement, colIndex: string) =>
  container.querySelector<HTMLElement>(
    `${BODY_CELL}[aria-colindex='${colIndex}']`,
  )!

// --- Synthetic mouse choreography ---------------------------------------------
// The TanStack resize handler reads `clientX` off a mousedown, then off document
// `mousemove`s, and ends on document `mouseup` (columnResizeMode 'onChange', so
// width is applied live on each move). ResizeHandler wires its own `mouseup`
// listener to fire `onResizeEnd`, so the same up event both ends the drag and
// runs the plugin hook.

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

const fireMouse = (
  type: 'mousedown' | 'mousemove' | 'mouseup',
  target: Element | Document,
  x: number,
  y: number,
) => {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  )
}

/** Press the grip and pass the first move; the pointer stays down. */
const beginResize = async (grip: HTMLElement) => {
  const r = grip.getBoundingClientRect()
  const x0 = r.left + r.width / 2
  const y = r.top + r.height / 2
  fireMouse('mousedown', grip, x0, y)
  await nextFrame()
  return { x0, y }
}

/** Full drag: press the grip, move by `dx` px, release. */
const resizeBy = async (grip: HTMLElement, dx: number) => {
  const { x0, y } = await beginResize(grip)
  fireMouse('mousemove', document, x0 + dx, y)
  await nextFrame()
  await nextFrame()
  fireMouse('mousemove', document, x0 + dx, y)
  await nextFrame()
  fireMouse('mouseup', document, x0 + dx, y)
  await nextFrame()
  await nextFrame()
}

/** Reveal a header's hover-hidden grip with a trusted pointer, return it. */
const revealGrip = async (cell: HTMLElement) => {
  await userEvent.hover(cell)
  const grip = gripOf(cell)
  await expect.poll(() => getComputedStyle(wrapperOf(grip)).opacity).toBe('1')
  return grip
}

// --- Setup guard --------------------------------------------------------------
// Not a requirement itself; it protects the resize requirements from silently
// passing when the grid renders no body rows to check width-sync (CR8) against.

describe('Column Resizing — setup guard', () => {
  test('ColumnResizing story renders header grips and body rows', async () => {
    const container = await renderColumnResizing()
    expect(container.querySelector(RESIZE_GRIP)).not.toBeNull()
    expect(container.querySelector(BODY_CELL)).not.toBeNull()
  })
})

// --- Requirements (CR1–CR15) --------------------------------------------------

describe('Column Resizing — requirements', () => {
  test('CR1: the plugin is inert without `enableColumnResizing`', async () => {
    const container = await renderColumnResizing({ enableColumnResizing: false })
    // Feature off → getCanResize() is false → no grip and no resizable header.
    expect(container.querySelector(RESIZE_GRIP)).toBeNull()
    renderedDataCells(container).forEach(cell => {
      expect(cell.getAttribute('data-column-resizable')).toBe('false')
    })
  })

  test('CR2: each resizable data column gets a resize grip in its header', async () => {
    const container = await renderColumnResizing()
    const dataCells = renderedDataCells(container)
    expect(dataCells.length).toBeGreaterThan(0)
    dataCells.forEach(cell => {
      expect(cell.getAttribute('data-column-resizable')).toBe('true')
    })
    // Every rendered data column carries exactly one grip.
    expect(
      container.querySelectorAll(`${DATA_HEAD_CELL} ${RESIZE_GRIP}`).length,
    ).toBe(dataCells.length)
  })

  test('CR3: the resize grip exposes role="separator"', async () => {
    const container = await renderColumnResizing()
    const grip = gripOf(firstDataCell(container))
    expect(grip.querySelector('[role="separator"]')).not.toBeNull()
  })

  test('CR4: the grip is hidden (opacity 0) until the header is hovered', async () => {
    const container = await renderColumnResizing()
    const wrapper = wrapperOf(gripOf(firstDataCell(container)))
    expect(wrapper.getAttribute('data-button-active')).toBe('false')
    expect(getComputedStyle(wrapper).opacity).toBe('0')
  })

  test('CR5: the grip is revealed on header hover', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)
    const wrapper = wrapperOf(gripOf(cell))

    // Trusted hover (real pointer) triggers the CSS `:hover` reveal on the cell.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(wrapper).opacity).toBe('1')
  })

  test('CR6: dragging the grip right widens the column live', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)
    const before = widthOf(cell)

    // Press and move right without releasing — width grows mid-drag ('onChange').
    const grip = await revealGrip(cell)
    const { x0, y } = await beginResize(grip)
    fireMouse('mousemove', document, x0 + 160, y)
    await expect.poll(() => widthOf(firstDataCell(container))).toBeGreaterThan(before)
    fireMouse('mouseup', document, x0 + 160, y)
  })

  test('CR7: while resizing the grip is active and the header is marked resizing', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)

    const grip = await revealGrip(cell)
    const { x0, y } = await beginResize(grip)
    fireMouse('mousemove', document, x0 + 120, y)

    // Mid-drag: the grip stays active and the header advertises the resize.
    // Both are reactive — the grip via `ColumnSizingComponent`'s subscription
    // and the header via `HeadCell`'s subscription to `getIsResizing()`.
    await expect
      .poll(() =>
        wrapperOf(gripOf(firstDataCell(container))).getAttribute(
          'data-button-active',
        ),
      )
      .toBe('true')
    await expect
      .poll(() => firstDataCell(container).getAttribute('data-column-resizing'))
      .toBe('true')

    fireMouse('mouseup', document, x0 + 120, y)

    // After release the header no longer reports resizing.
    await expect
      .poll(() => firstDataCell(container).getAttribute('data-column-resizing'))
      .toBe('false')
  })

  test('CR8: body cells track the header width (shared `--col-<id>-size`)', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)
    const colIndex = colIndexOf(cell)

    const grip = await revealGrip(cell)
    await resizeBy(grip, 150)

    // Head and body of the same column read the same width variable, so they
    // stay in lock-step after a resize.
    await expect
      .poll(() =>
        Math.abs(
          widthOf(firstDataCell(container)) -
            widthOf(bodyCellAt(container, colIndex)),
        ),
      )
      .toBeLessThan(1)
  })

  test('CR9: the new width persists after release', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)
    const before = widthOf(cell)

    const grip = await revealGrip(cell)
    await resizeBy(grip, 150)

    // Width stays widened once the pointer is up (persisted in columnSizing state).
    const after = widthOf(firstDataCell(container))
    expect(after).toBeGreaterThan(before + 100)
    await nextFrame()
    await nextFrame()
    expect(widthOf(firstDataCell(container))).toBe(after)
  })

  test('CR10: releasing calls `onColumnResizeEnd` with id and new width', async () => {
    const onColumnResizeEnd = vi.fn()
    const container = await renderColumnResizing({ onColumnResizeEnd })

    // Read the resized column's logical id from the DOM contract
    // (`data-column-id`) instead of hard-coding a mock column id.
    const cell = firstDataCell(container)
    const columnId = cell.getAttribute('data-column-id')!
    expect(columnId).toBeTruthy()
    const before = widthOf(cell)

    const grip = await revealGrip(cell)
    await resizeBy(grip, 150)

    expect(onColumnResizeEnd).toHaveBeenCalled()
    const last = onColumnResizeEnd.mock.calls.at(-1)![0] as {
      id: string
      width: number
    }
    expect(last.id).toBe(columnId)
    // Reported width is the widened size, and matches what's on screen.
    expect(last.width).toBeGreaterThan(before)
    expect(Math.abs(last.width - widthOf(firstDataCell(container)))).toBeLessThan(2)
  })

  test('CR11: double-clicking the grip resets the column and calls the hook', async () => {
    const onColumnResizeEnd = vi.fn()
    const container = await renderColumnResizing({ onColumnResizeEnd })
    const cell = firstDataCell(container)
    const original = widthOf(cell)

    // Widen first so the reset is observable…
    const grip = await revealGrip(cell)
    await resizeBy(grip, 160)
    expect(widthOf(firstDataCell(container))).toBeGreaterThan(original + 100)

    // …then a double-click on the grip restores the default width and fires the
    // hook with that restored width (not a hard-coded fallback).
    onColumnResizeEnd.mockClear()
    await userEvent.dblClick(gripOf(firstDataCell(container)))
    await expect
      .poll(() => Math.abs(widthOf(firstDataCell(container)) - original))
      .toBeLessThan(2)
    expect(onColumnResizeEnd).toHaveBeenCalled()
    const reset = onColumnResizeEnd.mock.calls.at(-1)![0] as {
      id: string
      width: number
    }
    expect(reset.width).toBeCloseTo(original, 0)
  })

  test('CR12: a column cannot shrink below its minSize', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)

    // Grow it first so there is room to shrink back down.
    let grip = await revealGrip(cell)
    await resizeBy(grip, 200)
    const grown = widthOf(firstDataCell(container))

    // Shove far left — the width clamps at the column's floor, not below it.
    grip = gripOf(firstDataCell(container))
    await resizeBy(grip, -2000)
    const clamped = widthOf(firstDataCell(container))
    expect(clamped).toBeLessThan(grown)
    expect(clamped).toBeGreaterThan(0)

    // A second extreme leftward drag can't push it any narrower.
    await resizeBy(gripOf(firstDataCell(container)), -2000)
    expect(Math.abs(widthOf(firstDataCell(container)) - clamped)).toBeLessThan(1)
  })

  test('CR13: resizing one column does not change its siblings', async () => {
    const container = await renderColumnResizing()
    const cells = renderedDataCells(container)
    const target = cells[0]
    const sibling = cells[1]
    const siblingBefore = widthOf(sibling)

    const grip = await revealGrip(target)
    await resizeBy(grip, 150)

    // The dragged column grew; the neighbour kept its width.
    expect(widthOf(renderedDataCells(container)[0])).toBeGreaterThan(
      widthOf(sibling),
    )
    expect(Math.abs(widthOf(renderedDataCells(container)[1]) - siblingBefore)).toBeLessThan(1)
  })

  test('CR14: the row-actions service column is not resizable', async () => {
    const container = await renderColumnResizing({
      enableRowSelection: true,
      enableRowActions: true,
      columnCount: 5,
    })

    const serviceHeads = Array.from(
      container.querySelectorAll<HTMLElement>(
        `${HEAD_CELL}[data-actions-column-cell='true']`,
      ),
    )
    expect(serviceHeads.length).toBeGreaterThan(0)
    serviceHeads.forEach(cell => {
      // No grip and not advertised as resizable.
      expect(cell.querySelector(RESIZE_GRIP)).toBeNull()
      expect(cell.getAttribute('data-column-resizable')).toBe('false')
    })
  })

  test('CR15: multi-level headers make group headers non-resizable, leaves resizable', async () => {
    const container = await renderColumnResizing({ showHeaderGroups: true })

    const heads = Array.from(
      container.querySelectorAll<HTMLElement>(HEAD_CELL),
    )
    // A group (spanning) header is not resizable and carries no grip…
    const groupHead = heads.find(
      cell => cell.getAttribute('data-column-resizable') === 'false',
    )
    expect(groupHead).toBeDefined()
    expect(groupHead!.querySelector(RESIZE_GRIP)).toBeNull()

    // …while at least one leaf data column stays resizable with its grip.
    const leafHead = heads.find(
      cell =>
        cell.getAttribute('data-column-resizable') === 'true' &&
        cell.getAttribute('data-actions-column-cell') === 'false',
    )
    expect(leafHead).toBeDefined()
    expect(leafHead!.querySelector(RESIZE_GRIP)).not.toBeNull()
  })
})
