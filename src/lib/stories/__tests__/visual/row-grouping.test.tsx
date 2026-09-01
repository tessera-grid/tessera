import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'

// Each Row Grouping requirement is its own named test, prefixed with its spec ID
// (RG1–RG11 from the requirements table in docs/decisions/0016-row-grouping.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the `RowGrouping` story: a flat deterministic generated set, started
// ungrouped. Grouping is toggled by clicking a column header's group button and
// state is read from the DOM contract (the `.column-group__button` + its
// `data-button-active` wrapper, the row `data-group-row`), not from mock literals
// (ADR 0009 — no hard-coded mock data).

const composed = composeStories(stories)

// --- Selectors (part of the component contract) -------------------------------

const HEAD_CELL = '.data-grid__head-cell'
const BODY_ROW = '.data-grid__body-row'
/** A header cell of a real (non-action) data column. */
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`
/** The RowGrouping plugin's group toggle, rendered per groupable header. */
const GROUP_BUTTON = '.column-group__button'
/** A column with few distinct values — grouping it aggregates into a few groups. */
const GROUPED_COLUMN = 'gender'
/** Group button icon size per `GroupButton` (`<GroupIcon width={16} height={16}>`). */
const GROUP_ICON_SIZE = 16

// --- Rendering / DOM helpers --------------------------------------------------

type StoryArgs = Partial<Parameters<typeof composed.RowGrouping>[0]>

/** Render the RowGrouping story and wait until its header cells are on screen. */
async function renderRowGrouping(args: StoryArgs = {}) {
  const { container } = await render(<composed.RowGrouping {...args} />)
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/** Header cell of a column by its logical id. */
const headCellById = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)

/** The group toggle inside a header cell (absent when the column is not groupable). */
const groupButtonOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(GROUP_BUTTON)

/**
 * The hover-hidden wrapper around a group button. It carries `data-button-active`,
 * so it can be found structurally regardless of the (hashed) module class name;
 * it is the element `buttonVisibility.css` toggles opacity on.
 */
const hiddenWrapperOf = (button: HTMLElement) =>
  button.closest<HTMLElement>('[data-button-active]')!

/** Body rows in visual (top-to-bottom) order — real rows only (skip padding). */
const rowsTopDown = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(BODY_ROW))
    .filter(row => row.getAttribute('data-index') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )

const isGroupRow = (row: HTMLElement) =>
  row.getAttribute('data-group-row') === 'true'

/** Rendered data-column ids in visual (left-to-right) order. */
const dataColumnIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(DATA_HEAD_CELL))
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )
    .map(cell => cell.getAttribute('data-column-id'))

/** Reveal a header cell's hover-hidden controls with a trusted pointer. */
const revealGroupButton = async (cell: HTMLElement) => {
  await userEvent.hover(cell)
  const button = groupButtonOf(cell)!
  await expect
    .poll(() => getComputedStyle(hiddenWrapperOf(button)).opacity)
    .toBe('1')
  return button
}

/** Group by a column (id): reveal its header button and click it. */
const groupByColumn = async (container: HTMLElement, id: string) => {
  const button = await revealGroupButton(headCellById(container, id)!)
  await userEvent.click(button)
}

// --- Requirements (RG1–RG11) --------------------------------------------------

describe('Row Grouping — activation & affordance', () => {
  test('RG1: the plugin is inert without `enableGrouping`', async () => {
    const container = await renderRowGrouping({ enableGrouping: false })
    // No group toggle in any header.
    expect(container.querySelector(GROUP_BUTTON)).toBeNull()
  })

  test('RG2: a groupable column header carries a group button', async () => {
    const container = await renderRowGrouping()
    const head = headCellById(container, GROUPED_COLUMN)
    expect(head).not.toBeNull()
    expect(groupButtonOf(head!)).not.toBeNull()
  })

  test('RG3: a service (actions) column has no group button', async () => {
    // Add a service column (row actions) and prove it exposes no group toggle,
    // while a real data column still does.
    const container = await renderRowGrouping({ enableRowActions: true })
    const actionsHead = container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-actions-column-cell='true']`,
    )
    expect(actionsHead).not.toBeNull()
    expect(groupButtonOf(actionsHead!)).toBeNull()
    expect(
      groupButtonOf(headCellById(container, GROUPED_COLUMN)!),
    ).not.toBeNull()
  })
})

describe('Row Grouping — toggle', () => {
  test('RG4: clicking the button groups by the column and produces group rows', async () => {
    const container = await renderRowGrouping()
    // No group rows before grouping.
    expect(rowsTopDown(container).some(isGroupRow)).toBe(false)

    await groupByColumn(container, GROUPED_COLUMN)

    // Grouped: the visible top-level rows are aggregated group rows.
    await expect.poll(() => rowsTopDown(container).some(isGroupRow)).toBe(true)
    expect(rowsTopDown(container).every(isGroupRow)).toBe(true)

    // Restore.
    await groupByColumn(container, GROUPED_COLUMN)
    await expect.poll(() => rowsTopDown(container).some(isGroupRow)).toBe(false)
  })

  test('RG5: the grouped column button is marked active', async () => {
    const container = await renderRowGrouping()
    await groupByColumn(container, GROUPED_COLUMN)

    await expect
      .poll(() => {
        const button = groupButtonOf(headCellById(container, GROUPED_COLUMN)!)!
        return hiddenWrapperOf(button).getAttribute('data-button-active')
      })
      .toBe('true')

    // Restore.
    await groupByColumn(container, GROUPED_COLUMN)
  })

  test('RG6: clicking again ungroups and clears the active state', async () => {
    const container = await renderRowGrouping()

    // Group…
    await groupByColumn(container, GROUPED_COLUMN)
    await expect.poll(() => rowsTopDown(container).some(isGroupRow)).toBe(true)

    // …then ungroup: group rows go away and the button is no longer active.
    await groupByColumn(container, GROUPED_COLUMN)
    await expect.poll(() => rowsTopDown(container).some(isGroupRow)).toBe(false)
    const button = groupButtonOf(headCellById(container, GROUPED_COLUMN)!)!
    expect(hiddenWrapperOf(button).getAttribute('data-button-active')).toBe(
      'false',
    )
  })

  test('RG7: grouping aggregates rows into fewer top-level rows', async () => {
    const container = await renderRowGrouping()
    const flatCount = rowsTopDown(container).length
    expect(flatCount).toBeGreaterThan(3)

    await groupByColumn(container, GROUPED_COLUMN)
    await expect.poll(() => rowsTopDown(container).some(isGroupRow)).toBe(true)

    // A handful of group rows stands in for many flat rows.
    expect(rowsTopDown(container).length).toBeLessThan(flatCount)

    // Restore.
    await groupByColumn(container, GROUPED_COLUMN)
  })
})

describe('Row Grouping — visibility & layout', () => {
  test('RG8: the group button is hidden until the header is hovered', async () => {
    const container = await renderRowGrouping()
    const button = groupButtonOf(headCellById(container, GROUPED_COLUMN)!)!

    // Hidden at rest (not grouped, not hovered)…
    expect(getComputedStyle(hiddenWrapperOf(button)).opacity).toBe('0')

    // …revealed on a trusted header hover.
    await userEvent.hover(headCellById(container, GROUPED_COLUMN)!)
    await expect
      .poll(() => getComputedStyle(hiddenWrapperOf(button)).opacity)
      .toBe('1')
  })

  test('RG9: the active group button stays visible without hover', async () => {
    const container = await renderRowGrouping()
    await groupByColumn(container, GROUPED_COLUMN)

    // Move the pointer off the grouped header onto a different header.
    await userEvent.hover(headCellById(container, 'firstName')!)

    const button = groupButtonOf(headCellById(container, GROUPED_COLUMN)!)!
    await expect
      .poll(() => getComputedStyle(hiddenWrapperOf(button)).opacity)
      .toBe('1')

    // Restore.
    await groupByColumn(container, GROUPED_COLUMN)
  })

  test('RG10: grouping keeps the column in place (`groupedColumnMode: false`)', async () => {
    const container = await renderRowGrouping()
    const before = dataColumnIds(container)

    await groupByColumn(container, GROUPED_COLUMN)
    await expect.poll(() => rowsTopDown(container).some(isGroupRow)).toBe(true)

    // The grouped column is neither moved to the front nor hidden — order holds.
    expect(dataColumnIds(container)).toEqual(before)
    expect(headCellById(container, GROUPED_COLUMN)).not.toBeNull()

    // Restore.
    await groupByColumn(container, GROUPED_COLUMN)
  })
})

describe('Row Grouping — appearance', () => {
  test('RG11: the group button icon is 16×16', async () => {
    const container = await renderRowGrouping()
    const button = await revealGroupButton(
      headCellById(container, GROUPED_COLUMN)!,
    )
    const svg = button.querySelector<SVGElement>('svg')!
    const style = getComputedStyle(svg)
    expect(style.width).toBe(`${GROUP_ICON_SIZE}px`)
    expect(style.height).toBe(`${GROUP_ICON_SIZE}px`)
  })
})
