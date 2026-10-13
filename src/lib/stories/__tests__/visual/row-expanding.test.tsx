import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import axe from 'axe-core'

import { composed } from '../stories'
import { DEFAULT_LABELS } from '../../../core/localization'
import { waitForBodyText } from './column-pinning-helpers'
import { AXE_OPTIONS, gridRoot, inBothThemes } from './a11y-helpers'
import { ROW_NESTING_INDENT_PX } from '../../../core/rowNesting'
import { COLUMN_EXPANDING_ID } from '../../../../lib/plugins/rowExpanding'

// Each Row Expanding requirement is its own named test, prefixed with its spec ID
// (RE1–RE11 from the requirements table in docs/decisions/0015-row-expanding.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the `RowExpanding` story: a deterministic generated tree (group
// roots with nested groups one level down) plus a couple of flat leaf roots,
// started collapsed. State is read from the DOM/ARIA contract (row
// `data-expanded`/`aria-expanded`, the `.row-expand-button` toggle, the service
// column's `data-column-id`), not from mock literals.

// --- Selectors (part of the component contract) -------------------------------

const HEAD_CELL = '.data-grid__head-cell'
const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'
/** The row-expanding toggle (stable class on `ExpandButton`). */
const TOGGLE = '.row-expand-button'
const chevron = (row: HTMLElement) =>
  row.querySelector<SVGElement>(`${TOGGLE} svg`)!
/** Depth indent step per `getCellExpandingStyles` (`ROW_NESTING_INDENT_PX`). */
const DEPTH_OFFSET_PX = ROW_NESTING_INDENT_PX

// --- Rendering / DOM helpers --------------------------------------------------

type RowExpandingArgs = Partial<Parameters<typeof composed.RowExpanding>[0]>

/** Body rows in visual (top-to-bottom) order — real rows only (skip padding). */
const rowsTopDown = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(BODY_ROW))
    .filter(row => row.getAttribute('data-index') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )

/** The expand toggle inside a body row (absent when the row is not expandable). */
const rowToggle = (row: HTMLElement) => row.querySelector<HTMLElement>(TOGGLE)

/** The header cell of the service expanding column. */
const expandingHeadCell = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(
    `${HEAD_CELL}[data-column-id='${COLUMN_EXPANDING_ID}']`,
  )

/** First user (non-service) cell of a row — the one that carries the depth indent. */
const firstUserCell = (row: HTMLElement) =>
  row.querySelector<HTMLElement>(
    `${BODY_CELL}[data-actions-column-cell='false']`,
  )

const isRowExpanded = (row: HTMLElement) =>
  row.getAttribute('data-expanded') === 'true'

const paddingLeftOf = (el: HTMLElement) =>
  parseFloat(getComputedStyle(el).paddingLeft) || 0

/** Render the RowExpanding story and wait until its rows are on screen. */
async function renderRowExpanding(args: RowExpandingArgs = {}) {
  const { container } = await render(<composed.RowExpanding {...args} />)
  await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(3)
  return container
}

// --- Requirements (RE1–RE13) --------------------------------------------------

describe('Row Expanding — activation & service column', () => {
  test('RE1: the plugin is inert without `enableRowExpanding`', async () => {
    const container = await renderRowExpanding({ enableRowExpanding: false })
    // No expanding service column and no toggle anywhere.
    expect(container.querySelector(TOGGLE)).toBeNull()
    expect(expandingHeadCell(container)).toBeNull()
  })

  test('RE2: enabling adds a leading service column and an expandable row gets a toggle', async () => {
    const container = await renderRowExpanding()
    const head = expandingHeadCell(container)
    expect(head).not.toBeNull()
    // It is a service (actions) column…
    expect(head!.getAttribute('data-actions-column-cell')).toBe('true')
    // …and at least one visible row (a group root) carries an expand toggle.
    const rows = rowsTopDown(container)
    expect(rows.some(row => rowToggle(row) !== null)).toBe(true)
  })

  test('RE3: the expanding column is not sortable, resizable, pinnable or draggable', async () => {
    // Turn sorting and resizing ON to prove the service column stays inert.
    const container = await renderRowExpanding({
      enableColumnSorting: true,
      enableColumnSizing: true,
    })
    const head = expandingHeadCell(container)!
    // No sort affordance (aria-sort omitted on a non-sortable column) and not
    // resizable; no sort control is rendered inside it.
    expect(head.hasAttribute('aria-sort')).toBe(false)
    expect(head.getAttribute('data-column-resizable')).toBe('false')
    expect(head.querySelector('.column-sort__button')).toBeNull()
  })
})

describe('Row Expanding — toggle', () => {
  /** First expandable (group) row in top-down order. */
  const firstExpandable = (container: HTMLElement) =>
    rowsTopDown(container).find(row => rowToggle(row) !== null)!

  test('RE4: clicking the toggle expands the row and reveals its children', async () => {
    const container = await renderRowExpanding()
    const before = rowsTopDown(container).length
    const parent = firstExpandable(container)

    await userEvent.click(rowToggle(parent)!)
    // The row is marked expanded and more rows are now on screen (its children).
    await expect
      .poll(() => isRowExpanded(firstExpandable(container)))
      .toBe(true)
    expect(rowsTopDown(container).length).toBeGreaterThan(before)

    // Restore: collapse back to the initial state (self-restoring).
    await userEvent.click(rowToggle(firstExpandable(container))!)
    await expect.poll(() => rowsTopDown(container).length).toBe(before)
  })

  test('RE5: clicking the toggle again collapses the row and hides its children', async () => {
    const container = await renderRowExpanding()
    const collapsed = rowsTopDown(container).length

    // Expand…
    await userEvent.click(rowToggle(firstExpandable(container))!)
    await expect
      .poll(() => isRowExpanded(firstExpandable(container)))
      .toBe(true)
    expect(rowsTopDown(container).length).toBeGreaterThan(collapsed)

    // …then collapse: the children go away and the row is no longer expanded.
    await userEvent.click(rowToggle(firstExpandable(container))!)
    await expect
      .poll(() => isRowExpanded(firstExpandable(container)))
      .toBe(false)
    expect(rowsTopDown(container).length).toBe(collapsed)
  })

  test('RE6: toggling calls the `onExpandRow` hook with the row and next state', async () => {
    const onExpandRow = vi.fn()
    const container = await renderRowExpanding({ onExpandRow })
    const parent = firstExpandable(container)

    await userEvent.click(rowToggle(parent)!)
    // Called with the row object and the next expanded state (true).
    await expect.poll(() => onExpandRow.mock.calls.length).toBeGreaterThan(0)
    expect(onExpandRow.mock.calls.at(-1)![1]).toBe(true)
    expect(onExpandRow.mock.calls.at(-1)![0]).toBeTypeOf('object')

    // Collapse → hook fires again with the next state false (also restores state).
    await userEvent.click(rowToggle(firstExpandable(container))!)
    await expect.poll(() => onExpandRow.mock.calls.at(-1)?.[1]).toBe(false)
  })
})

describe('Row Expanding — expandability & depth', () => {
  test('RE7: a leaf (non-group) row gets no toggle and no expanded state', async () => {
    const container = await renderRowExpanding()
    const rows = rowsTopDown(container)

    // The fixture mixes group roots (with a toggle) and flat leaf roots (without).
    const leaves = rows.filter(row => rowToggle(row) === null)
    expect(leaves.length).toBeGreaterThan(0)
    expect(rows.some(row => rowToggle(row) !== null)).toBe(true)

    // A non-expandable row carries no expansion state attribute at all.
    leaves.forEach(leaf => {
      expect(leaf.hasAttribute('data-expanded')).toBe(false)
      expect(leaf.hasAttribute('aria-expanded')).toBe(false)
    })
  })

  test('RE8: a group deeper than `maxExpandingDepth` gets no toggle', async () => {
    const container = await renderRowExpanding()
    const parent = rowsTopDown(container).find(row => rowToggle(row) !== null)!

    // Expand a top-level group to reveal its (grouped) children one level down.
    await userEvent.click(rowToggle(parent)!)
    await expect
      .poll(() => rowsTopDown(container).some(row => isRowExpanded(row)))
      .toBe(true)

    // The revealed children sit one level deeper (indented) — and even though the
    // fixture nests groups there, none of them gets a toggle (max depth = 1).
    const deeper = rowsTopDown(container).filter(
      row => paddingLeftOf(firstUserCell(row)!) >= DEPTH_OFFSET_PX,
    )
    expect(deeper.length).toBeGreaterThan(0)
    expect(deeper.every(row => rowToggle(row) === null)).toBe(true)

    // Restore.
    await userEvent.click(
      rowToggle(rowsTopDown(container).find(row => rowToggle(row) !== null)!)!,
    )
  })
})

describe('Row Expanding — indentation', () => {
  test('RE9: a child row is indented by its depth', async () => {
    const container = await renderRowExpanding()
    const parent = rowsTopDown(container).find(row => rowToggle(row) !== null)!

    // A top-level row sits flush (no depth indent).
    expect(paddingLeftOf(firstUserCell(parent)!)).toBe(0)

    await userEvent.click(rowToggle(parent)!)
    await expect
      .poll(() =>
        rowsTopDown(container).some(
          row => paddingLeftOf(firstUserCell(row)!) === DEPTH_OFFSET_PX,
        ),
      )
      .toBe(true)

    // A depth-1 child is indented by exactly one step.
    const child = rowsTopDown(container).find(
      row => paddingLeftOf(firstUserCell(row)!) === DEPTH_OFFSET_PX,
    )!
    expect(paddingLeftOf(firstUserCell(child)!)).toBe(DEPTH_OFFSET_PX)

    // Restore.
    await userEvent.click(
      rowToggle(rowsTopDown(container).find(row => rowToggle(row) !== null)!)!,
    )
  })
})

describe('Row Expanding — accessibility & appearance', () => {
  test('RE10: in a treegrid (keyboard navigation) the row exposes expansion via `aria-expanded`', async () => {
    const container = await renderRowExpanding({
      enableKeyboardNavigation: true,
    })
    expect(container.querySelector('[role="treegrid"]')).not.toBeNull()
    const parent = rowsTopDown(container).find(row => rowToggle(row) !== null)!

    // Collapsed: expandable row advertises aria-expanded='false'…
    expect(parent.getAttribute('aria-expanded')).toBe('false')
    // …a leaf row has no aria-expanded at all.
    const leaf = rowsTopDown(container).find(row => rowToggle(row) === null)!
    expect(leaf.hasAttribute('aria-expanded')).toBe(false)

    // Expanding flips it to 'true'.
    await userEvent.click(rowToggle(parent)!)
    await expect
      .poll(() =>
        rowsTopDown(container)
          .find(row => rowToggle(row) !== null)!
          .getAttribute('aria-expanded'),
      )
      .toBe('true')

    // Restore.
    await userEvent.click(
      rowToggle(rowsTopDown(container).find(row => rowToggle(row) !== null)!)!,
    )
  })

  test('RE11: the toggle chevron points down when collapsed and up when expanded', async () => {
    const container = await renderRowExpanding()
    const parent = rowsTopDown(container).find(row => rowToggle(row) !== null)!

    // Иконка expand — шеврон вниз: свёрнутая строка без поворота, раскрытая — на 180°.
    expect(getComputedStyle(chevron(parent)).transform).toBe('none')

    await userEvent.click(rowToggle(parent)!)
    await expect
      .poll(() => isRowExpanded(firstExpandableRow(container)))
      .toBe(true)

    const icon = chevron(firstExpandableRow(container))
    await Promise.all(icon.getAnimations().map(animation => animation.finished))
    const { a, b, c, d } = new DOMMatrix(getComputedStyle(icon).transform)
    expect([a, b, c, d].map(Math.round)).toEqual([-1, 0, 0, -1])

    // Restore.
    await userEvent.click(rowToggle(firstExpandableRow(container))!)
    await expect
      .poll(() => isRowExpanded(firstExpandableRow(container)))
      .toBe(false)
  })
})

describe('Row Expanding — chevron motion', () => {
  test('RE41: the chevron turn is animated with the motion tokens', async () => {
    const container = await renderRowExpanding()
    const parent = rowsTopDown(container).find(row => rowToggle(row) !== null)!

    await userEvent.click(rowToggle(parent)!)
    const icon = chevron(firstExpandableRow(container))
    const turn = icon
      .getAnimations()
      .find(
        (animation): animation is CSSTransition =>
          animation instanceof CSSTransition &&
          animation.transitionProperty === 'transform',
      )
    const duration = getComputedStyle(icon).getPropertyValue(
      '--tsr-comp-motion-duration',
    )
    expect(turn?.effect?.getTiming().duration).toBe(parseFloat(duration))

    // Restore.
    await userEvent.click(rowToggle(firstExpandableRow(container))!)
    await expect
      .poll(() => isRowExpanded(firstExpandableRow(container)))
      .toBe(false)
  })
})

describe('Row Expanding — accessibility', () => {
  test('RE12: without keyboard navigation (role=table) the toggle carries aria-expanded, rows do not, and the expanded tree passes axe', async () => {
    // Обычные строки и строки с перетаскиванием (DraggableBodyRow).
    for (const args of [{}, { enableRowDragging: true }]) {
      const view = await render(<composed.RowExpanding {...args} />)
      const { container } = view
      await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(3)
      expect(container.querySelector('[role="table"]')).not.toBeNull()
      const toggle = () => rowToggle(firstExpandableRow(container))!

      expect(toggle().getAttribute('aria-expanded')).toBe('false')
      await userEvent.click(toggle())
      await expect
        .poll(() => toggle().getAttribute('aria-expanded'))
        .toBe('true')

      expect(
        rowsTopDown(container).filter(row => row.hasAttribute('aria-expanded')),
      ).toEqual([])
      await inBothThemes(async () => {
        const { violations } = await axe.run(gridRoot(), {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(violations).toEqual([])
      })
      await view.unmount()
    }
  })

  test('RE13: the toggle name and tooltip name the action of the current state, aria-expanded carries the state', async () => {
    const container = await renderRowExpanding()
    const toggle = () => rowToggle(firstExpandableRow(container))!

    expect(toggle().getAttribute('aria-label')).toBe(DEFAULT_LABELS.expandRow)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    await userEvent.hover(toggle())
    expect(await waitForBodyText(DEFAULT_LABELS.expandRow)).toBe(true)

    await userEvent.click(toggle())
    await expect.poll(() => toggle().getAttribute('aria-expanded')).toBe('true')
    expect(toggle().getAttribute('aria-label')).toBe(DEFAULT_LABELS.collapseRow)
    // Указатель уходит и возвращается — тултип открывается заново, уже раскрытой строки.
    await userEvent.hover(rowsTopDown(container).at(-1)!)
    await userEvent.hover(toggle())
    expect(await waitForBodyText(DEFAULT_LABELS.collapseRow)).toBe(true)

    // Restore.
    await userEvent.click(toggle())
    await expect
      .poll(() => toggle().getAttribute('aria-expanded'))
      .toBe('false')
  })
})

/** First expandable (group) row in top-down order (shared by appearance specs). */
function firstExpandableRow(container: HTMLElement) {
  return rowsTopDown(container).find(row => row.querySelector(TOGGLE) !== null)!
}

// Шаг отступа вложенности (ADR 0059, RE61): 16px на уровень у строк дерева и групп без
// линий дерева (с линиями шаг свой — ADR 0102).
describe('Row Expanding — nesting step', () => {
  test('RE61: by default without tree lines a row of depth d shifts the first user column content by 16px × d, for tree rows and grouped rows', async () => {
    const paddings = () =>
      [...document.querySelectorAll<HTMLElement>('.data-grid__body-cell')]
        .map(cell => parseFloat(getComputedStyle(cell).paddingLeft))
        .filter(value => value > 0)
    const tree = await render(
      <composed.RowExpandingTreeLines rowExpandingTreeLines={false} />,
    )
    await expect.poll(() => paddings().includes(48)).toBe(true)
    expect(new Set(paddings())).toEqual(new Set([16, 32, 48]))
    await tree.unmount()

    await render(
      <composed.RowGrouping
        enableRowExpanding
        initialGrouping={['gender']}
        initialExpanded={true}
      />,
    )
    await expect.poll(() => paddings().length).toBeGreaterThan(0)
    expect(new Set(paddings())).toEqual(new Set([16]))
  })
})
