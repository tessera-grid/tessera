import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'
import { revealedHandleWidth } from '../helpers'

import { ENGLISH_LABELS } from '../../../core/localization'
import { ResizeHandler } from '../../../plugins/columnSizing/ResizeHandler'
import { composed } from '../stories'
import {
  pinFirstColumn,
  renderColumnPinning,
  scrollerOf,
} from './column-pinning-helpers'
import { ColumnResizingGrid } from './columns-fixtures'
import { columnSizingLabels } from '../../../plugins/columnSizing/labels'

// Every Column Resizing requirement is its own named test, prefixed with its spec
// ID (CR1–CR16 from the requirements table in docs/decisions/0013-column-sizing.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the canonical `ColumnResizing` story. The leftmost data column is
// resized so there is always room to the right to drag into. Synthetic mouse
// events drive the TanStack resize handler (mousedown on the grip → mousemove on
// document → mouseup); the one thing they can't do — the CSS `:hover` reveal
// (CR5) — uses trusted browser input.

// --- Selectors (part of the component contract) -------------------------------

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
/** ColumnSizing plugin's resize grip, rendered per resizable header. */
const RESIZE_GRIP = '.resize__handler--column'
/** A header cell of a real (non-action) data column. */
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`
/** Высота черты грипа при наведении и в активном состоянии, px. */
const GRIP_ACTIVE_HEIGHT = 20

// --- Rendering / DOM helpers --------------------------------------------------

type StoryArgs = Partial<Parameters<typeof ColumnResizingGrid>[0]>

/** Render the ColumnResizing story and wait until its header cells are on screen. */
async function renderColumnResizing(args: StoryArgs = {}) {
  const { container } = await render(<ColumnResizingGrid {...args} />)
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
const firstDataCell = (container: HTMLElement) =>
  renderedDataCells(container)[0]

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
    const container = await renderColumnResizing({
      enableColumnSizing: false,
    })
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
    await expect
      .poll(() => widthOf(firstDataCell(container)))
      .toBeGreaterThan(before)
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
    expect(
      Math.abs(last.width - widthOf(firstDataCell(container))),
    ).toBeLessThan(2)
  })

  test('CR11: the grip menu item «Reset width» resets the column and calls the hook', async () => {
    const onColumnResizeEnd = vi.fn()
    const container = await renderColumnResizing({ onColumnResizeEnd })
    const cell = firstDataCell(container)
    const original = widthOf(cell)

    // Widen first so the reset is observable…
    const grip = await revealGrip(cell)
    await resizeBy(grip, 160)
    expect(widthOf(firstDataCell(container))).toBeGreaterThan(original + 100)

    // …then a click on the grip opens its menu; «Reset width» restores the default
    // width and fires the hook with that restored width (not a hard-coded fallback).
    await revealGrip(firstDataCell(container))
    await userEvent.click(gripOf(firstDataCell(container)))
    const reset = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find(
        item =>
          item.textContent?.trim() ===
          columnSizingLabels(ENGLISH_LABELS).resetColumnWidth,
      )
    await expect.poll(reset).toBeTruthy()
    onColumnResizeEnd.mockClear()
    await userEvent.click(reset()!)
    await expect
      .poll(() => Math.abs(widthOf(firstDataCell(container)) - original))
      .toBeLessThan(2)
    expect(onColumnResizeEnd).toHaveBeenCalled()
    const call = onColumnResizeEnd.mock.calls.at(-1)![0] as {
      id: string
      width: number
    }
    expect(call.width).toBeCloseTo(original, 0)
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
    expect(Math.abs(widthOf(firstDataCell(container)) - clamped)).toBeLessThan(
      1,
    )
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
    expect(
      Math.abs(widthOf(renderedDataCells(container)[1]) - siblingBefore),
    ).toBeLessThan(1)
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
    const container = await renderColumnResizing({ headerNesting: 'nested' })

    const heads = Array.from(container.querySelectorAll<HTMLElement>(HEAD_CELL))
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

  test('CR16: while resizing the grid is non-interactive except the active grip', async () => {
    const container = await renderColumnResizing()
    const cells = renderedDataCells(container)
    const target = cells[0]
    const siblingColIndex = colIndexOf(cells[1])

    // The scroll container carries the `data-resizing` seam CSS gates the
    // interactive-isolation on (`columnSizingInfo.isResizingColumn !== false`).
    const scroll = () =>
      container.querySelector<HTMLElement>('[data-resizing]')!
    expect(scroll().getAttribute('data-resizing')).toBe('false')

    // Press the grip and pass a move so the drag is in flight.
    const grip = await revealGrip(target)
    const { x0, y } = await beginResize(grip)
    fireMouse('mousemove', document, x0 + 120, y)

    // Mid-drag the container advertises the resize…
    await expect.poll(() => scroll().getAttribute('data-resizing')).toBe('true')
    // …neighbouring header and body cells are inert to the pointer, so the
    // cursor drifting onto them raises no hover / click / sort…
    expect(
      getComputedStyle(renderedDataCells(container)[1]).pointerEvents,
    ).toBe('none')
    expect(
      getComputedStyle(bodyCellAt(container, siblingColIndex)).pointerEvents,
    ).toBe('none')
    // …while the active grip stays live (so it holds `col-resize`); its
    // `data-button-active` is reactive, so poll it back to 'auto'.
    await expect
      .poll(
        () =>
          getComputedStyle(gripOf(renderedDataCells(container)[0]))
            .pointerEvents,
      )
      .toBe('auto')

    fireMouse('mouseup', document, x0 + 120, y)

    // Release lifts the isolation: container is unmarked and cells interact again.
    await expect
      .poll(() => scroll().getAttribute('data-resizing'))
      .toBe('false')
    expect(
      getComputedStyle(renderedDataCells(container)[1]).pointerEvents,
    ).not.toBe('none')
  })

  test('CR18: while dragging the grip the columns to the right follow its edge — header and body, without gap or overlap, mid-drag and after release', async () => {
    const container = await renderColumnResizing()
    const [first, ...rest] = renderedDataCells(container)
    const columns = [first, ...rest.slice(0, 3)].map(colIndexOf)
    const before = widthOf(first)
    const head = (colIndex: string) =>
      container.querySelector<HTMLElement>(
        `${HEAD_CELL}[aria-colindex='${colIndex}']`,
      )!
    /** Правый край каждой колонки совпадает с левым краем следующей. */
    const adjacent = () => {
      for (const cellOf of [head, (i: string) => bodyCellAt(container, i)]) {
        for (let i = 0; i < columns.length - 1; i++) {
          const right = cellOf(columns[i]).getBoundingClientRect().right
          const left = cellOf(columns[i + 1]).getBoundingClientRect().left
          expect(
            Math.abs(right - left),
            `${columns[i]} → ${columns[i + 1]}`,
          ).toBeLessThan(1)
        }
      }
    }

    await revealGrip(first)
    const separator = gripOf(first)
      .querySelector<HTMLElement>('[role="separator"]')!
      .getBoundingClientRect()
    const from = {
      x: separator.left + separator.width / 2,
      y: separator.top + separator.height / 2,
    }
    const pointer = commands as unknown as {
      realDragHold: (from: object, to: object) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    await pointer.realDragHold(from, { x: from.x + 80, y: from.y })
    try {
      await expect
        .poll(() => widthOf(head(columns[0])))
        .toBeGreaterThan(before + 60)
      await nextFrame()
      adjacent()
    } finally {
      await pointer.realMouseUp()
    }
    await expect
      .poll(() => container.querySelector('[data-resizing="true"]'))
      .toBeNull()
    await nextFrame()
    await nextFrame()
    adjacent()
  })

  test('CR21: scrolling sideways mid-drag keeps the mounted columns to the right at its edge — header and body, without gap or overlap', async () => {
    const container = await renderColumnResizing({ columnCount: 40 })
    const scroller = container.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    const first = firstDataCell(container)
    const before = widthOf(first)
    const head = (colIndex: string) =>
      container.querySelector<HTMLElement>(
        `${HEAD_CELL}[aria-colindex='${colIndex}']`,
      )
    // Колонки, смонтированные до протяжки: тело и шапка не перерисовываются, пока тянут грип.
    const mounted = renderedDataCells(container).map(colIndexOf)
    /** У каждой пары соседних смонтированных колонок правый край — у левого края следующей. */
    const adjacent = () => {
      for (const cellOf of [head, (i: string) => bodyCellAt(container, i)]) {
        for (let i = 0; i < mounted.length - 1; i++) {
          const left = cellOf(mounted[i])
          const right = cellOf(mounted[i + 1])
          if (!left || !right) continue
          if (Number(mounted[i + 1]) !== Number(mounted[i]) + 1) continue
          expect(
            Math.abs(
              left.getBoundingClientRect().right -
                right.getBoundingClientRect().left,
            ),
            `${mounted[i]} → ${mounted[i + 1]}`,
          ).toBeLessThan(1)
        }
      }
    }

    await revealGrip(first)
    const separator = gripOf(first)
      .querySelector<HTMLElement>('[role="separator"]')!
      .getBoundingClientRect()
    const from = {
      x: separator.left + separator.width / 2,
      y: separator.top + separator.height / 2,
    }
    const to = { x: from.x + 80, y: from.y }
    const pointer = commands as unknown as {
      realDragHold: (from: object, to: object) => Promise<void>
      realMouseUp: () => Promise<void>
      realWheel: (
        at: object,
        deltaY: number,
        ticks: number,
        intervalMs: number,
        deltaX: number,
      ) => Promise<void>
    }
    await pointer.realDragHold(from, to)
    try {
      await expect
        .poll(() => widthOf(head(colIndexOf(first))!))
        .toBeGreaterThan(before + 60)
      // Колесо по горизонтали, не отпуская грип: окно колонок уходит вправо.
      await pointer.realWheel(to, 0, 4, 30, 300)
      await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(600)
      await nextFrame()
      await nextFrame()
      expect(container.querySelector('[data-resizing="true"]')).not.toBeNull()
      adjacent()
    } finally {
      await pointer.realMouseUp()
    }
  })

  test('CR19: the grip line is centred on the header right border — on hover and mid-drag', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)
    const lineOf = () =>
      gripOf(firstDataCell(container)).querySelector<HTMLElement>(
        '[role="separator"]',
      )!
    /** Расстояние от середины черты до правой границы заголовка, px (ADR 0111). */
    const gap = () => {
      const line = lineOf().getBoundingClientRect()
      return Math.abs(
        firstDataCell(container).getBoundingClientRect().right -
          (line.left + line.width / 2),
      )
    }

    await revealGrip(cell)
    await expect.poll(gap).toBeLessThanOrEqual(1)

    const line = lineOf().getBoundingClientRect()
    const from = {
      x: line.left + line.width / 2,
      y: line.top + line.height / 2,
    }
    const pointer = commands as unknown as {
      realDragHold: (from: object, to: object) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    await pointer.realDragHold(from, { x: from.x + 60, y: from.y })
    try {
      await expect
        .poll(() =>
          firstDataCell(container).getAttribute('data-column-resizing'),
        )
        .toBe('true')
      await expect.poll(gap).toBeLessThanOrEqual(1)
    } finally {
      await pointer.realMouseUp()
    }
  })

  test('CR20: the grip line stays extended while resizing or while its width menu is open, without hover', async () => {
    const container = await renderColumnResizing()
    const cell = firstDataCell(container)
    const lineHeight = () =>
      gripOf(firstDataCell(container))
        .querySelector<HTMLElement>('[role="separator"]')!
        .getBoundingClientRect().height
    const pointer = commands as unknown as {
      realDragHold: (from: object, to: object) => Promise<void>
      realMouseUp: () => Promise<void>
    }

    // Протяжка: указатель ушёл с грипа вниз, в тело — наведения на грипе нет.
    await revealGrip(cell)
    const line = gripOf(cell)
      .querySelector<HTMLElement>('[role="separator"]')!
      .getBoundingClientRect()
    const from = {
      x: line.left + line.width / 2,
      y: line.top + line.height / 2,
    }
    await pointer.realDragHold(from, { x: from.x + 40, y: from.y + 120 })
    try {
      await expect
        .poll(() =>
          firstDataCell(container).getAttribute('data-column-resizing'),
        )
        .toBe('true')
      await expect.poll(lineHeight).toBe(GRIP_ACTIVE_HEIGHT)
    } finally {
      await pointer.realMouseUp()
    }
    await expect
      .poll(() => container.querySelector('[data-resizing="true"]'))
      .toBeNull()

    // Меню ширины: клик открывает меню, указатель уходит на дальнюю колонку.
    await revealGrip(firstDataCell(container))
    await userEvent.click(gripOf(firstDataCell(container)))
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    await userEvent.hover(renderedDataCells(container)[3])
    await expect
      .poll(() =>
        wrapperOf(gripOf(firstDataCell(container))).getAttribute(
          'data-button-active',
        ),
      )
      .toBe('true')
    await expect.poll(lineHeight).toBe(GRIP_ACTIVE_HEIGHT)
    await userEvent.keyboard('{Escape}')
  })
})

// Грип ширины на границе колонок (ADR 0111). Указатель — настоящий (Playwright).

type Point = { x: number; y: number }
const realPointer = commands as unknown as {
  realMouseMove: (from: Point, to: Point, steps?: number) => Promise<void>
  realDragHold: (from: Point, to: Point, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
}
/** Половина зоны грипа: `--tsr-comp-resize-handler-width` / 2, px. */
const HALF = 12

const zoneOf = (cell: HTMLElement) =>
  wrapperOf(gripOf(cell)).getBoundingClientRect()
const middleY = (cell: HTMLElement) => {
  const r = cell.getBoundingClientRect()
  return r.top + r.height / 2
}
/** Элемент под точкой принадлежит грипу заголовка `cell`. */
const hitsGrip = (cell: HTMLElement, x: number, y: number) =>
  gripOf(cell).contains(document.elementFromPoint(x, y))

describe('Грип ширины на границе колонок (ADR 0111)', () => {
  test('GB1: грип — на правой границе колонки: зона 24px, по 12px в каждую колонку, черта на границе; у последней колонки зона целиком внутри', async () => {
    const container = await renderColumnResizing({ columnCount: 4 })
    const [first] = renderedDataCells(container)
    const r = first.getBoundingClientRect()
    const zone = zoneOf(first)
    expect(zone.width).toBeCloseTo(HALF * 2, 0)
    expect(zone.left).toBeCloseTo(r.right - HALF, 0)
    expect(zone.right).toBeCloseTo(r.right + HALF, 0)
    // Правая половина над соседом — тоже грип этой колонки.
    expect(hitsGrip(first, r.right + HALF / 2, middleY(first))).toBe(true)
    expect(hitsGrip(first, r.right - HALF / 2, middleY(first))).toBe(true)

    // Последняя колонка — в конце прокрутки.
    const scroller = scrollerOf(container)
    scroller.scrollLeft = scroller.scrollWidth
    await expect
      .poll(() =>
        container.querySelector(
          `${DATA_HEAD_CELL}[data-last-header-in-row='true']`,
        ),
      )
      .not.toBeNull()
    await nextFrame()
    const last = container.querySelector<HTMLElement>(
      `${DATA_HEAD_CELL}[data-last-header-in-row='true']`,
    )!
    const lr = last.getBoundingClientRect()
    const lastZone = zoneOf(last)
    expect(lastZone.right).toBeCloseTo(lr.right, 0)
    expect(lastZone.left).toBeCloseTo(lr.right - HALF * 2, 0)
  })

  test('GB2: содержимое заголовка не сдвигается при наведении; кнопки не заходят под зону грипа и видны целиком; подпись под зону заходит и при видимой черте затухает', async () => {
    const container = await renderColumnResizing({
      columnCount: 4,
      enableColumnSorting: true,
    })
    const [first] = renderedDataCells(container)
    const content = first.querySelector<HTMLElement>(
      '.data-grid__cell-wrapper-content',
    )!
    const titleEl = first.querySelector<HTMLElement>(
      '.data-grid__cell-wrapper-title',
    )!
    // Подпись кончается у зоны своего грипа: зона — в свободных отступах двух колонок.
    expect(titleEl.getBoundingClientRect().right).toBeLessThanOrEqual(
      zoneOf(first).left,
    )
    const before = getComputedStyle(content).paddingRight
    await revealGrip(first)
    expect(getComputedStyle(content).paddingRight).toBe(before)
    // Кнопки — левее зоны, целиком в заголовке.
    const buttons = [
      ...first.querySelectorAll<HTMLElement>(
        'button:not(.drag__handler--column)',
      ),
    ].filter(b => b.getBoundingClientRect().width > 0)
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      const r = button.getBoundingClientRect()
      expect(r.right).toBeLessThanOrEqual(zoneOf(first).left)
      expect(r.left).toBeGreaterThanOrEqual(first.getBoundingClientRect().left)
    }
    // У черты нет ни заливки, ни затемнения.
    expect(getComputedStyle(wrapperOf(gripOf(first))).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    )
    expect(getComputedStyle(wrapperOf(gripOf(first)), '::before').content).toBe(
      'none',
    )
  })

  test('GB3: у соседа ручка перетаскивания колонки и подпись правее зоны грипа слева; зоны нажатия не пересекаются', async () => {
    const container = await renderColumnResizing({
      columnCount: 4,
      enableColumnDragging: true,
    })
    const [first, second] = renderedDataCells(container)
    const border = first.getBoundingClientRect().right
    await userEvent.hover(second)
    const handleEl = second.querySelector<HTMLElement>(
      '.drag__handler--column',
    )!
    // Ручка раскрывается по ширине (ADR 0114) — мерить раскрытую.
    await expect
      .poll(() => handleEl.parentElement!.getBoundingClientRect().width)
      .toBe(revealedHandleWidth(handleEl))
    const handle = handleEl.getBoundingClientRect()
    const title = second
      .querySelector<HTMLElement>('.data-grid__cell-wrapper-title')!
      .getBoundingClientRect()
    expect(handle.left).toBeGreaterThanOrEqual(border + HALF - 0.5)
    expect(title.left).toBeGreaterThanOrEqual(border + HALF - 0.5)
    expect(zoneOf(first).right).toBeLessThanOrEqual(handle.left + 0.5)
    // Подпись не наезжает на сдвинутую ручку.
    expect(title.left).toBeGreaterThanOrEqual(handle.right - 0.5)
  })

  test('GB4: закрепление, вложенная шапка и виртуализация — грип закреплённой колонки поверх границы и после прокрутки, у групп — на их границах', async () => {
    // Закрепление: грип последней левой закреплённой колонки над прокручиваемой частью.
    let container = await renderColumnPinning({ enableColumnSizing: true })
    const pinned = await pinFirstColumn(container)
    const scroller = scrollerOf(container)
    scroller.scrollLeft = 200
    await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(0)
    await nextFrame()
    const pr = pinned.getBoundingClientRect()
    expect(hitsGrip(pinned, pr.right + HALF / 2, middleY(pinned))).toBe(true)
    // Виртуализация: у видимых прокрученных колонок грип на их границе.
    for (const cell of renderedDataCells(container)) {
      const r = cell.getBoundingClientRect()
      if (cell === pinned || r.right > scroller.getBoundingClientRect().right)
        continue
      if (cell.getAttribute('data-last-header-in-row') === 'true') continue
      const zone = zoneOf(cell)
      expect(
        Math.abs(zone.left + zone.width / 2 - r.right),
        cell.dataset.columnId,
      ).toBeLessThanOrEqual(1.5)
    }

    // Вложенная шапка: грип группы — на её правой границе.
    container = (
      await render(<composed.HeaderGroupsPlayground enableColumnSizing />)
    ).container
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)
    const group = [
      ...container.querySelectorAll<HTMLElement>(
        `${HEAD_CELL}[data-first-headers-row='true'][data-column-resizable='true']`,
      ),
    ].find(cell => cell.getAttribute('data-last-header-in-row') !== 'true')!
    const gr = group.getBoundingClientRect()
    const gz = zoneOf(group)
    expect(Math.abs(gz.left + gz.width / 2 - gr.right)).toBeLessThanOrEqual(1.5)
  })

  test('GB5: черта видна при наведении и скрыта без него; протяжка за правую половину зоны, клавиатура и меню ширины работают как раньше', async () => {
    const container = await renderColumnResizing({ columnCount: 4 })
    const [first] = renderedDataCells(container)
    const wrapper = wrapperOf(gripOf(first))
    expect(getComputedStyle(wrapper).opacity).toBe('0')
    await revealGrip(first)

    // Протяжка за половину зоны над соседом.
    const r = first.getBoundingClientRect()
    const from = { x: r.right + HALF / 2, y: middleY(first) }
    const width = widthOf(first)
    await realPointer.realMouseMove({ x: r.left + 4, y: from.y }, from, 4)
    await realPointer.realDragHold(from, { x: from.x + 40, y: from.y })
    await realPointer.realMouseUp()
    await expect
      .poll(() => widthOf(renderedDataCells(container)[0]))
      .toBeCloseTo(width + 40, -1)

    // Клавиатура: стрелка на разделителе.
    const separator = gripOf(
      renderedDataCells(container)[0],
    ).querySelector<HTMLElement>('[role="separator"]')!
    const before = widthOf(renderedDataCells(container)[0])
    separator.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect
      .poll(() => widthOf(renderedDataCells(container)[0]))
      .toBeCloseTo(before + 10, 0)

    // Меню ширины: клик по половине зоны над соседом.
    const now = renderedDataCells(container)[0].getBoundingClientRect()
    const tap = {
      x: now.right + HALF / 2,
      y: middleY(renderedDataCells(container)[0]),
    }
    await realPointer.realMouseMove({ x: now.left + 4, y: tap.y }, tap, 4)
    await realPointer.realDragHold(tap, tap, 1)
    await realPointer.realMouseUp()
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role="menuitem"]')].some(
          item =>
            item.textContent?.trim() ===
            columnSizingLabels(ENGLISH_LABELS).resetColumnWidth,
        ),
      )
      .toBe(true)
    await userEvent.keyboard('{Escape}')
  })
})

describe('Грип вне грида (ADR 0111)', () => {
  test('GB11: черта грипа — цветом грипа и вне грида: глобальный сброс цвета рамок окружения её не перекрашивает', async () => {
    const reset = document.createElement('style')
    reset.textContent = '* { border-color: rgb(255, 0, 0); }'
    document.head.append(reset)
    try {
      await render(
        <div className="data-grid-theme">
          <div
            className="data-grid__head-cell"
            style={{ position: 'relative', width: 200, height: 50 }}
          >
            <ResizeHandler
              isResizing={false}
              size={200}
              minSize={80}
              onResize={() => {}}
              onResizeEnd={() => {}}
              onResizeCancel={() => {}}
              onEscape={() => {}}
              onResetSize={() => {}}
              onResizeBy={() => {}}
            />
          </div>
        </div>,
      )
      const separator = document.querySelector<HTMLElement>(
        `${RESIZE_GRIP} [role="separator"]`,
      )!
      const style = getComputedStyle(separator)
      expect(style.borderTopColor).not.toBe('rgb(255, 0, 0)')
      expect(style.borderTopColor).toBe(
        getComputedStyle(separator.closest(RESIZE_GRIP)!).color,
      )
    } finally {
      reset.remove()
    }
  })
})

describe('Кнопки заголовка при протяжке (ADR 0111)', () => {
  test('GB10: нажатие на грип, протяжка и открытое меню ширины не прячут кнопки заголовка — ни в одном кадре до отпускания и закрытия меню', async () => {
    const container = await renderColumnResizing({
      columnCount: 4,
      enableColumnSorting: true,
    })
    const cell = () => renderedDataCells(container)[0]
    /** Скрываемые кнопки заголовка, кроме самого грипа: видимость и ширина. */
    const buttons = () =>
      [...cell().querySelectorAll<HTMLElement>('.cell__button--hidden')]
        .filter(button => !button.matches(RESIZE_GRIP))
        .map(button => ({
          opacity: Number(getComputedStyle(button).opacity),
          width: Math.round(button.getBoundingClientRect().width),
        }))
    await revealGrip(cell())
    await expect
      .poll(() => buttons().every(button => button.opacity === 1))
      .toBe(true)
    const shown = buttons()
    expect(shown.length).toBeGreaterThan(0)

    const frames: ReturnType<typeof buttons>[] = []
    let sampling = true
    const sample = () => {
      if (!sampling) return
      frames.push(buttons())
      requestAnimationFrame(sample)
    }
    const r = cell().getBoundingClientRect()
    const at = { x: r.right, y: r.top + r.height / 2 }
    await realPointer.realMouseMove({ x: r.left + 8, y: at.y }, at, 4)
    requestAnimationFrame(sample)
    try {
      // Нажать и увести указатель вниз, с заголовка: протяжка продолжается.
      await realPointer.realDragHold(at, { x: at.x + 20, y: at.y + 120 }, 6)
      await new Promise(resolve => setTimeout(resolve, 300))
      sampling = false
      expect(frames.length).toBeGreaterThan(5)
      for (const frame of frames) expect(frame).toEqual(shown)
    } finally {
      sampling = false
      await realPointer.realMouseUp()
    }

    // Клик без сдвига — меню ширины; пока оно открыто, кнопки стоят.
    const now = cell().getBoundingClientRect()
    const tap = { x: now.right, y: now.top + now.height / 2 }
    await realPointer.realMouseMove({ x: now.left + 8, y: tap.y }, tap, 4)
    await realPointer.realDragHold(tap, tap, 1)
    await realPointer.realMouseUp()
    await expect
      .poll(() => document.querySelector('[role="menuitem"]'))
      .not.toBeNull()
    // Указатель уходит с заголовка в сторону.
    await realPointer.realMouseMove(tap, { x: tap.x, y: tap.y + 200 }, 4)
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(buttons().map(button => button.opacity)).toEqual(
      shown.map(button => button.opacity),
    )
    await userEvent.keyboard('{Escape}')
  })
})
