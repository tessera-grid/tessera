import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'
// The PointerEvent plumbing is plugin-agnostic; reuse the vetted primitives from
// the row suite instead of duplicating them. Only the choreography below is
// column-specific (horizontal activation, head-cell targets).
import { firePointer, nextFrame } from '../../rowDragging.dnd'

// Every Column Dragging requirement is its own named test, prefixed with its spec
// ID (D15–D30, the column block of the shared drag & drop requirements table in
// docs/decisions/0006-dnd-with-dnd-kit.md; rows are D1–D14). So `npm test` reports
// — and fails — each requirement individually, and the test name points straight at
// the requirement it guards (see the naming rule in docs/decisions/0009-test-coverage-visual-and-performance.md).
// All tests drive the canonical `ColumnDragging` story, sized to overflow on both
// axes so the auto-scroll requirements (D26–D28) have real scroll distance.
// Synthetic pointer events drive the mechanics; the one thing they can't do — the
// CSS-`:hover` reveal (D21) — uses trusted browser input.

const composed = composeStories(stories)

// --- Selectors (part of the component contract) -------------------------------

/** Icon side per spec (`DragHandler.module.css`: `.button svg { 16px }`). */
const DRAG_ICON_SIZE = 16
/** Left content padding of a data cell (`COLUMN_CONTENT_PADDING`). */
const CONTENT_PADDING_LEFT = 16

const HEAD_CELL = '.data-grid__head-cell'
/** The drag handle inside a header cell (same handle class as the row plugin). */
const HANDLE = '.drag__handler--column'
const HEAD_HANDLE = `${HEAD_CELL} ${HANDLE}`
const CONTENT_WRAPPER = '.data-grid__cell-wrapper-content'
/** OverlayHeadCell container (the floating clone) — distinct from live cells. */
const OVERLAY = '.data-grid-head__cell--overlay'
/** ColumnPinning plugin's pin toggle, rendered per pinnable header. */
const PIN_BUTTON = '.column-pin__button'
/** The element that actually overflows and scrolls. */
const SCROLLER = '.MuiTableContainer-root'

// --- Rendering / DOM helpers --------------------------------------------------

type StoryArgs = Partial<Parameters<typeof composed.ColumnDragging>[0]>

/** Render the ColumnDragging story and wait until its header cells are on screen. */
async function renderColumnDragging(args: StoryArgs = {}) {
  const { container } = await render(<composed.ColumnDragging {...args} />)
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/** The overflowing scroll container of the rendered grid. */
const scrollerOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(SCROLLER)!

/** Rendered data-column header cells, in visual (left-to-right) order. */
const renderedCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(HEAD_CELL))
    // real columns carry aria-colindex; virtualization padding divs do not
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

const textOf = (cell: HTMLElement) => cell.textContent?.trim() ?? ''

/** Visible column order keyed by header text. */
const columnOrder = (container: HTMLElement) =>
  renderedCells(container).map(textOf)

/** Translate-X (px) baked into an element's computed transform. */
const translateX = (el: HTMLElement) => {
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 0
  return new DOMMatrixReadOnly(t).m41
}

/**
 * Pick a source cell and a distinct-text target that both sit away from the
 * horizontal edges, so a reorder move doesn't trip the edge auto-scroll and the
 * before/after order signatures can't collide on duplicate header text.
 */
const pickSourceTarget = (container: HTMLElement) => {
  const cells = renderedCells(container)
  const source = cells[1]
  const target =
    cells.slice(2).find(cell => textOf(cell) !== textOf(source)) ??
    cells[cells.length - 2]
  return { source, target }
}

/** Press on a header drag handle and pass the horizontal activation move. */
const beginColumnDrag = async (handle: HTMLElement) => {
  const hr = handle.getBoundingClientRect()
  const hx = hr.left + hr.width / 2
  const hy = hr.top + hr.height / 2
  firePointer('pointerdown', handle, hx, hy)
  await nextFrame()
  // Horizontal nudge past the sensor's activation; the axis modifier pins Y.
  firePointer('pointermove', document, hx + 6, hy)
  await nextFrame()
  await nextFrame()
  await nextFrame()
  return { hx, hy }
}

/** Drag `source`'s handle over `target`'s centre and drop. */
const dragColumnOnto = async (source: HTMLElement, target: HTMLElement) => {
  const handle = source.querySelector<HTMLElement>(HANDLE)!
  const { hy } = await beginColumnDrag(handle)
  const tr = target.getBoundingClientRect()
  const tx = tr.left + tr.width / 2
  firePointer('pointermove', document, tx, hy)
  await nextFrame()
  await nextFrame()
  firePointer('pointermove', document, tx + 1, hy)
  await nextFrame()
  await nextFrame()
  firePointer('pointerup', document, tx + 1, hy)
}

// --- Setup guard --------------------------------------------------------------
// Not a requirement itself; it protects the auto-scroll requirements (D26–D28)
// from silently passing when the grid doesn't actually overflow.

describe('Column Dragging — setup guard', () => {
  test('ColumnDragging story overflows on both axes (feeds D26–D28)', async () => {
    const scroller = scrollerOf(await renderColumnDragging())
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  })
})

// --- Requirements (D15–D30) ---------------------------------------------------

describe('Column Dragging — requirements', () => {
  test('D15: the plugin activates when `enableColumnDragging` is on', async () => {
    const container = await renderColumnDragging()
    expect(container.querySelectorAll(HEAD_HANDLE).length).toBeGreaterThan(0)
  })

  test('D16: only columns with `enableDragging` get a handle (per-column opt-in)', async () => {
    // Row actions add a non-draggable action column; it must carry no handle,
    // while the opt-in data columns each do. Few columns so nothing is
    // virtualized off-screen and the action column is guaranteed rendered.
    const container = await renderColumnDragging({
      enableRowActions: true,
      columnCount: 5,
    })
    const actionCell = container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-actions-column-cell='true']`,
    )!
    const dataCell = container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-actions-column-cell='false']`,
    )!
    expect(actionCell.querySelector(HANDLE)).toBeNull()
    expect(dataCell.querySelector(HANDLE)).not.toBeNull()
  })

  test('D17: the drag handle lives in the header cell (no service column)', async () => {
    const container = await renderColumnDragging()
    const handle = container.querySelector<HTMLElement>(HEAD_HANDLE)!
    const cell = handle.closest<HTMLElement>(HEAD_CELL)!

    // It sits inside a real data column's header cell...
    expect(cell.getAttribute('data-actions-column-cell')).toBe('false')
    // ...sharing that cell with the column's own title (not a dedicated column):
    // every rendered data column carries exactly one handle, so their counts match.
    expect(textOf(cell).length).toBeGreaterThan(0)
    expect(container.querySelectorAll(HEAD_HANDLE).length).toBe(
      renderedCells(container).length,
    )
  })

  test('D18: the drag handle icon is 16×16', async () => {
    const container = await renderColumnDragging()
    const svg = container.querySelector<HTMLElement>(`${HEAD_HANDLE} svg`)!
    const style = getComputedStyle(svg)
    expect(style.width).toBe(`${DRAG_ICON_SIZE}px`)
    expect(style.height).toBe(`${DRAG_ICON_SIZE}px`)
  })

  test('D19: the handle is absolutely positioned and fits the left content padding', async () => {
    const container = await renderColumnDragging()
    const handle = container.querySelector<HTMLElement>(HEAD_HANDLE)!
    const cell = handle.closest<HTMLElement>(HEAD_CELL)!
    const wrapper = cell.querySelector<HTMLElement>(CONTENT_WRAPPER)!

    const handleStyle = getComputedStyle(handle)
    expect(handleStyle.position).toBe('absolute')
    expect(handleStyle.left).toBe('0px')

    // The content wrapper's left padding is the gutter the handle must fit into.
    const padLeft = parseFloat(getComputedStyle(wrapper).paddingLeft)
    expect(padLeft).toBe(CONTENT_PADDING_LEFT)

    // Handle pinned to the cell's left edge and no wider than that gutter, so it
    // overlays the padding and never the title (which starts after the gutter).
    const handleRect = handle.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    expect(Math.abs(handleRect.left - cellRect.left)).toBeLessThan(2)
    expect(handleRect.right - cellRect.left).toBeLessThanOrEqual(padLeft + 1)
  })

  test('D20: the drag handle is hidden (opacity 0) until the header is hovered', async () => {
    const container = await renderColumnDragging()
    const icon = container.querySelector<HTMLElement>(`${HEAD_HANDLE} svg`)!
    expect(getComputedStyle(icon).opacity).toBe('0')
  })

  test('D21: the drag handle is revealed on header hover', async () => {
    const container = await renderColumnDragging()
    const cell = renderedCells(container)[0]
    const icon = cell.querySelector<HTMLElement>(`${HANDLE} svg`)!

    // Trusted hover (real pointer) triggers the CSS `:hover` reveal on the cell.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(icon).opacity).toBe('1')
  })

  test('D22: dragging shows the overlay clone of the header cell', async () => {
    const container = await renderColumnDragging()
    const { source, target } = pickSourceTarget(container)
    const handle = source.querySelector<HTMLElement>(HANDLE)!

    const { hy } = await beginColumnDrag(handle)
    const tr = target.getBoundingClientRect()
    const tx = tr.left + tr.width / 2
    firePointer('pointermove', document, tx, hy)
    await nextFrame()
    await nextFrame()
    try {
      await expect
        .poll(() => container.querySelector(OVERLAY) !== null)
        .toBe(true)
    } finally {
      firePointer('pointerup', document, tx, hy)
    }
  })

  test('D23: the source cell is hidden and neighbours shift via translateX', async () => {
    const container = await renderColumnDragging()
    const { source, target } = pickSourceTarget(container)
    const handle = source.querySelector<HTMLElement>(HANDLE)!

    const { hy } = await beginColumnDrag(handle)
    const tr = target.getBoundingClientRect()
    const tx = tr.left + tr.width / 2
    firePointer('pointermove', document, tx, hy)
    await nextFrame()
    await nextFrame()
    try {
      await expect
        .poll(() => {
          const cells = renderedCells(container)
          const sourceHidden = cells.some(
            cell => getComputedStyle(cell).opacity === '0',
          )
          const neighbourShifted = cells.some(
            cell =>
              getComputedStyle(cell).opacity !== '0' &&
              Math.abs(translateX(cell)) > 0.5,
          )
          return sourceHidden && neighbourShifted
        })
        .toBe(true)
    } finally {
      firePointer('pointerup', document, tx + 1, hy)
    }
  })

  test('D24: on drop the columnOrder changes → columns reorder', async () => {
    const container = await renderColumnDragging()
    const before = columnOrder(container)
    const { source, target } = pickSourceTarget(container)

    await dragColumnOnto(source, target)

    // The dropped column took a new position → the visible order differs, but no
    // column was lost (every prior header is still present, just reordered).
    await expect
      .poll(() => {
        const after = columnOrder(container)
        return (
          after.join('¦') !== before.join('¦') &&
          before.every(text => after.includes(text))
        )
      })
      .toBe(true)
  })

  test('D25: after drop the overlay is gone and the column re-renders in place', async () => {
    const container = await renderColumnDragging()
    const { source, target } = pickSourceTarget(container)

    await dragColumnOnto(source, target)

    // Overlay unmounts and no live cell is left hidden once the drag ends.
    await expect
      .poll(
        () =>
          container.querySelector(OVERLAY) === null &&
          renderedCells(container).every(
            cell => getComputedStyle(cell).opacity !== '0',
          ),
      )
      .toBe(true)
  })

  test('D26: dragging near the right edge auto-scrolls horizontally', async () => {
    const container = await renderColumnDragging()
    const scroller = scrollerOf(container)

    scroller.scrollLeft = 0
    scroller.scrollTop = 0
    await nextFrame()
    const handle = renderedCells(container)[1].querySelector<HTMLElement>(
      HANDLE,
    )!
    const { hy } = await beginColumnDrag(handle)
    const cr = scroller.getBoundingClientRect()
    // Hold inside the right threshold; dnd-kit keeps scrolling per frame.
    firePointer(
      'pointermove',
      document,
      cr.right - cr.width * 0.05,
      cr.top + cr.height / 2,
    )
    try {
      await expect
        .poll(() => scroller.scrollLeft, { timeout: 2000 })
        .toBeGreaterThan(0)
    } finally {
      firePointer('pointerup', document, cr.right - cr.width * 0.05, hy)
    }
    await nextFrame()
  })

  test('D27: a column reorders correctly after a horizontal scroll', async () => {
    const container = await renderColumnDragging()
    const scroller = scrollerOf(container)

    scroller.scrollLeft = Math.min(
      1200,
      scroller.scrollWidth - scroller.clientWidth,
    )
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }

    const before = columnOrder(container)
    const { source, target } = pickSourceTarget(container)

    await dragColumnOnto(source, target)

    await expect
      .poll(() => columnOrder(container).join('¦') !== before.join('¦'))
      .toBe(true)
  })

  test('D28: dragging near the bottom edge never scrolls vertically', async () => {
    const container = await renderColumnDragging()
    const scroller = scrollerOf(container)

    scroller.scrollLeft = 0
    scroller.scrollTop = 0
    await nextFrame()
    const handle = renderedCells(container)[1].querySelector<HTMLElement>(
      HANDLE,
    )!
    const { hy } = await beginColumnDrag(handle)
    const cr = scroller.getBoundingClientRect()
    // Near the bottom edge but horizontally centred; the X-only auto-scroll +
    // horizontal-axis modifier must keep the vertical scroll pinned.
    firePointer(
      'pointermove',
      document,
      cr.left + cr.width / 2,
      cr.bottom - cr.height * 0.03,
    )
    for (let i = 0; i < 40; i++) {
      // eslint-disable-next-line no-await-in-loop
      await nextFrame()
    }
    try {
      expect(scroller.scrollTop).toBe(0)
    } finally {
      firePointer('pointerup', document, cr.left + cr.width / 2, hy)
    }
    await nextFrame()
  })

  test('D29: a pinned column cannot be dragged (handle disabled)', async () => {
    const container = await renderColumnDragging({ enableColumnPinning: true })
    const firstCell = renderedCells(container)[0]

    // Reveal the hover-hidden controls, then pin the column.
    await userEvent.hover(firstCell)
    const pin = firstCell.querySelector<HTMLElement>(PIN_BUTTON)!
    await userEvent.click(pin)

    await expect
      .poll(
        () =>
          container.querySelector(`${HEAD_CELL}[data-cell-pinned='left']`) !==
          null,
      )
      .toBe(true)

    const pinnedCell = container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-cell-pinned='left']`,
    )!
    const handle = pinnedCell.querySelector<HTMLElement>(HANDLE)!
    // Disabled handle → `not-allowed` cursor (DragHandler `.disabled`).
    expect(getComputedStyle(handle).cursor).toBe('not-allowed')
  })

  test('D30: a column dropped onto the pinned column never lands in the pinned zone', async () => {
    const container = await renderColumnDragging({ enableColumnPinning: true })
    const firstCell = renderedCells(container)[0]

    await userEvent.hover(firstCell)
    await userEvent.click(firstCell.querySelector<HTMLElement>(PIN_BUTTON)!)

    await expect
      .poll(
        () =>
          container.querySelector(`${HEAD_CELL}[data-cell-pinned='left']`) !==
          null,
      )
      .toBe(true)

    const before = columnOrder(container)
    const pinnedCell = container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-cell-pinned='left']`,
    )!
    // Drag a non-adjacent draggable column toward the pinned one and drop on it.
    const source = renderedCells(container)[2]
    await dragColumnOnto(source, pinnedCell)

    // The drop commits a reorder (something moved), yet the pinned column stays
    // leftmost — a dropped column is clamped out of the pinned zone.
    await expect
      .poll(() => {
        const cells = renderedCells(container)
        const orderChanged =
          columnOrder(container).join('¦') !== before.join('¦')
        const pinnedStillFirst =
          cells[0]?.getAttribute('data-cell-pinned') === 'left'
        return orderChanged && pinnedStillFirst
      })
      .toBe(true)
  })
})
