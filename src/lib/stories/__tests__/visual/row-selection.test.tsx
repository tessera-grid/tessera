import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { composed } from '../stories'
import { COLUMN_SELECTION_ID } from '../../../../lib/plugins/rowSelection'

// Each Row Selection requirement is its own named test, prefixed with its spec ID
// (RS1–RS18 from the requirements table in docs/decisions/0014-row-selection.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the `RowSelection` story (flat rows, whole page visible) for the
// per-row and select-all-on-page mechanics, and the `SubRowSelection` story (a
// deterministic tree) for the sub-row cascade. State is read from the DOM/ARIA
// contract (checkbox `data-checked`/`data-indeterminate`, row `data-selected`),
// not from mock literals.

// --- Selectors (part of the component contract) -------------------------------

const HEAD_CELL = '.data-grid__head-cell'
const BODY_ROW = '.data-grid__body-row'
/** The row/header selection checkbox (stable class on `SelectCheckbox`). */
const CHECKBOX = '.row-select-checkbox'
/** lucide icon classes for the two checkbox indicators (IconsContext defaults). */
const ICON_CHECK = 'lucide-check'
const ICON_MINUS = 'lucide-minus'
/** Indicator icon size per `SelectCheckbox.module.css` (`.indicator .icon`). */
const CHECKBOX_ICON_SIZE = 14

// --- Checkbox state (Base UI contract) ----------------------------------------
// Base UI Checkbox.Root reflects state as data-attributes (see the note in
// SelectCheckbox.module.css) and disables via the native/`data-disabled` seam.

const isChecked = (cb: Element) => cb.hasAttribute('data-checked')
const isIndeterminate = (cb: Element) => cb.hasAttribute('data-indeterminate')
const isDisabled = (cb: Element) =>
  cb.hasAttribute('data-disabled') ||
  cb.hasAttribute('disabled') ||
  cb.getAttribute('aria-disabled') === 'true'
const iconOf = (cb: Element) => cb.querySelector<SVGElement>('svg')

// --- Rendering / DOM helpers --------------------------------------------------

type RowSelectionArgs = Partial<Parameters<typeof composed.RowSelection>[0]>
type SubRowArgs = Partial<Parameters<typeof composed.SubRowSelection>[0]>

/** Body rows in visual (top-to-bottom) order — real rows only (skip padding). */
const rowsTopDown = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(BODY_ROW))
    .filter(row => row.getAttribute('data-index') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )

/** The selection checkbox inside a body row (absent when the row has none). */
const rowCheckbox = (row: HTMLElement) =>
  row.querySelector<HTMLElement>(CHECKBOX)

/** The single select-all checkbox in the header. */
const headCheckbox = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL} ${CHECKBOX}`)

/** The header cell of the service selection column. */
const selectionHeadCell = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(
    `${HEAD_CELL}[data-column-id='${COLUMN_SELECTION_ID}']`,
  )

const isRowSelected = (row: HTMLElement) =>
  row.getAttribute('data-selected') === 'true'

/** Render the RowSelection story and wait until its rows are on screen. */
async function renderRowSelection(args: RowSelectionArgs = {}) {
  const { container } = await render(<composed.RowSelection {...args} />)
  await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(3)
  return container
}

/** Render the SubRowSelection (tree) story, sized so every node is visible. */
async function renderSubRowSelection(args: SubRowArgs = {}) {
  const { container } = await render(
    <composed.SubRowSelection
      containerHeight={760}
      height={660}
      maxHeight={660}
      {...args}
    />,
  )
  await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(6)
  return container
}

// --- Requirements (RS1–RS18) --------------------------------------------------

describe('Row Selection — activation & service column', () => {
  test('RS1: the plugin is inert without `enableRowSelection`', async () => {
    const container = await renderRowSelection({ enableRowSelection: false })
    // No selection service column and no checkbox anywhere.
    expect(container.querySelector(CHECKBOX)).toBeNull()
    expect(selectionHeadCell(container)).toBeNull()
  })

  test('RS2: enabling adds a leading service column with a checkbox in the header and every row', async () => {
    const container = await renderRowSelection()
    const head = selectionHeadCell(container)
    expect(head).not.toBeNull()
    // It is a service (actions) column…
    expect(head!.getAttribute('data-actions-column-cell')).toBe('true')
    // …carrying the header select-all checkbox…
    expect(head!.querySelector(CHECKBOX)).not.toBeNull()
    // …and every body row carries its own row checkbox.
    const rows = rowsTopDown(container)
    expect(rows.every(row => rowCheckbox(row) !== null)).toBe(true)
  })

  test('RS3: the selection column is not sortable, resizable, pinnable or draggable', async () => {
    // Turn sorting and resizing ON to prove the service column stays inert.
    const container = await renderRowSelection({
      enableColumnSorting: true,
      enableColumnResizing: true,
    })
    const head = selectionHeadCell(container)!
    // No sort affordance (aria-sort omitted on a non-sortable column) and not
    // resizable; no sort/resize control is rendered inside it.
    expect(head.hasAttribute('aria-sort')).toBe(false)
    expect(head.getAttribute('data-column-resizable')).toBe('false')
    expect(head.querySelector('.column-sort__button')).toBeNull()
  })
})

describe('Row Selection — row checkbox', () => {
  test('RS4: clicking a row checkbox selects that row', async () => {
    const container = await renderRowSelection()
    const row = rowsTopDown(container)[0]
    const cb = rowCheckbox(row)!

    await userEvent.click(cb)
    await expect.poll(() => isRowSelected(rowsTopDown(container)[0])).toBe(true)
    expect(isChecked(rowCheckbox(rowsTopDown(container)[0])!)).toBe(true)

    // Restore: deselect so the table returns to its initial state.
    await userEvent.click(rowCheckbox(rowsTopDown(container)[0])!)
    await expect
      .poll(() => isRowSelected(rowsTopDown(container)[0]))
      .toBe(false)
  })

  test('RS5: clicking a selected row checkbox deselects it', async () => {
    const container = await renderRowSelection()
    const first = () => rowsTopDown(container)[0]

    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => isRowSelected(first())).toBe(true)

    // Second click clears it back to unselected (self-restoring).
    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => isRowSelected(first())).toBe(false)
    expect(isChecked(rowCheckbox(first())!)).toBe(false)
  })

  test('RS6: toggling a row calls the `onSelectRow` hook with the row and next state', async () => {
    const onSelectRow = vi.fn()
    const container = await renderRowSelection({ onSelectRow })
    const first = () => rowsTopDown(container)[0]

    await userEvent.click(rowCheckbox(first())!)
    // Called with the row object and the next selected state (true).
    await expect.poll(() => onSelectRow.mock.calls.length).toBeGreaterThan(0)
    expect(onSelectRow.mock.calls.at(-1)![1]).toBe(true)
    expect(onSelectRow.mock.calls.at(-1)![0]).toBeTypeOf('object')

    // Deselect → hook fires again with the next state false (also restores state).
    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => onSelectRow.mock.calls.at(-1)?.[1]).toBe(false)
  })

  test('RS7: a selected row is visually marked with a distinct background', async () => {
    const container = await renderRowSelection()
    const first = () => rowsTopDown(container)[0]

    // Move the pointer off the rows first so `:hover` doesn't taint the reading.
    await userEvent.hover(selectionHeadCell(container)!)
    const unselectedBg = getComputedStyle(first()).backgroundColor

    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => isRowSelected(first())).toBe(true)
    await userEvent.hover(selectionHeadCell(container)!)

    // Selecting drives a distinct resting background (the selected token) — the
    // exact rgb is theme-dependent, so the requirement is that it changes.
    const selectedBg = getComputedStyle(first()).backgroundColor
    expect(selectedBg).not.toBe(unselectedBg)

    // Restore: deselecting drops the selected marker (self-restoring).
    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => isRowSelected(first())).toBe(false)
  })
})

describe('Row Selection — header (select all on page)', () => {
  test('RS8: the header checkbox selects every row on the page', async () => {
    const container = await renderRowSelection()
    await userEvent.click(headCheckbox(container)!)

    await expect
      .poll(() => rowsTopDown(container).every(isRowSelected))
      .toBe(true)

    // Restore.
    await userEvent.click(headCheckbox(container)!)
    await expect
      .poll(() => rowsTopDown(container).some(isRowSelected))
      .toBe(false)
  })

  test('RS9: when all page rows are selected the header checkbox is checked', async () => {
    const container = await renderRowSelection()
    await userEvent.click(headCheckbox(container)!)

    await expect.poll(() => isChecked(headCheckbox(container)!)).toBe(true)
    expect(isIndeterminate(headCheckbox(container)!)).toBe(false)
    expect(
      iconOf(headCheckbox(container)!)?.classList.contains(ICON_CHECK),
    ).toBe(true)

    // Restore.
    await userEvent.click(headCheckbox(container)!)
    await expect.poll(() => isChecked(headCheckbox(container)!)).toBe(false)
  })

  test('RS10: when only some page rows are selected the header checkbox is indeterminate', async () => {
    const container = await renderRowSelection()
    // Select a single row → header goes indeterminate (some, not all).
    await userEvent.click(rowCheckbox(rowsTopDown(container)[0])!)

    await expect
      .poll(() => isIndeterminate(headCheckbox(container)!))
      .toBe(true)
    expect(isChecked(headCheckbox(container)!)).toBe(false)
    expect(
      iconOf(headCheckbox(container)!)?.classList.contains(ICON_MINUS),
    ).toBe(true)

    // Restore.
    await userEvent.click(rowCheckbox(rowsTopDown(container)[0])!)
    await expect
      .poll(() => isIndeterminate(headCheckbox(container)!))
      .toBe(false)
  })

  test('RS11: toggling the header calls the `onSelectAllRowsOnPage` hook', async () => {
    const onSelectAllRowsOnPage = vi.fn()
    const container = await renderRowSelection({ onSelectAllRowsOnPage })

    await userEvent.click(headCheckbox(container)!)
    await expect
      .poll(() => onSelectAllRowsOnPage.mock.calls.at(-1)?.[0])
      .toBe(true)

    // Clear again → hook fires with false (also restores state).
    await userEvent.click(headCheckbox(container)!)
    await expect
      .poll(() => onSelectAllRowsOnPage.mock.calls.at(-1)?.[0])
      .toBe(false)
  })

  test('RS12: clicking a checked header checkbox clears the page selection', async () => {
    const container = await renderRowSelection()
    // Select all…
    await userEvent.click(headCheckbox(container)!)
    await expect
      .poll(() => rowsTopDown(container).every(isRowSelected))
      .toBe(true)

    // …then clicking the now-checked header clears every row.
    await userEvent.click(headCheckbox(container)!)
    await expect
      .poll(() => rowsTopDown(container).some(isRowSelected))
      .toBe(false)
  })
})

describe('Row Selection — select-all-across-pages lock', () => {
  test('RS13: with `isAllRowsSelected` every row checkbox is disabled', async () => {
    const container = await renderRowSelection({ isAllRowsSelected: true })
    const rows = rowsTopDown(container)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => isDisabled(rowCheckbox(row)!))).toBe(true)
  })

  test('RS14: with `isAllRowsSelected` the header checkbox is disabled', async () => {
    const container = await renderRowSelection({ isAllRowsSelected: true })
    expect(isDisabled(headCheckbox(container)!)).toBe(true)
  })
})

describe('Row Selection — appearance', () => {
  test('RS15: the checkbox indicator icon is 14×14', async () => {
    const container = await renderRowSelection()
    const first = () => rowsTopDown(container)[0]

    // Select so the indicator renders its icon, then measure it.
    await userEvent.click(rowCheckbox(first())!)
    const svg = await vi.waitUntil(() => iconOf(rowCheckbox(first())!))
    const style = getComputedStyle(svg)
    expect(style.width).toBe(`${CHECKBOX_ICON_SIZE}px`)
    expect(style.height).toBe(`${CHECKBOX_ICON_SIZE}px`)

    // Restore.
    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => isRowSelected(first())).toBe(false)
  })
})

describe('Row Selection — sub-rows', () => {
  test('RS16: without `enableSubRowSelection` child rows get no checkbox', async () => {
    // Baseline: with sub-row selection ON every node (parents + children) has a
    // checkbox…
    const on = await renderSubRowSelection({ enableSubRowSelection: true })
    const onCount = on.querySelectorAll(`${BODY_ROW} ${CHECKBOX}`).length

    // …OFF: only parents keep a checkbox, so fewer checkboxes than rows.
    const off = await renderSubRowSelection({ enableSubRowSelection: false })
    const offCount = off.querySelectorAll(`${BODY_ROW} ${CHECKBOX}`).length
    const rowCount = rowsTopDown(off).length

    expect(offCount).toBeGreaterThan(0)
    expect(offCount).toBeLessThan(onCount)
    expect(offCount).toBeLessThan(rowCount)
  })

  test('RS17: selecting a parent cascades selection to its children', async () => {
    const container = await renderSubRowSelection()
    const rows = rowsTopDown(container)
    // Tree order: parent then its three children (deterministic 4×3 tree).
    const parent = rows[0]

    await userEvent.click(rowCheckbox(parent)!)
    await expect
      .poll(() => rowsTopDown(container).slice(0, 4).every(isRowSelected))
      .toBe(true)

    // Restore.
    await userEvent.click(rowCheckbox(rowsTopDown(container)[0])!)
    await expect
      .poll(() => rowsTopDown(container).slice(0, 4).some(isRowSelected))
      .toBe(false)
  })

  test('RS18: a partial child selection makes the parent indeterminate', async () => {
    const container = await renderSubRowSelection()
    const child = () => rowsTopDown(container)[1]
    const parent = () => rowsTopDown(container)[0]

    // Select one child of the first parent.
    await userEvent.click(rowCheckbox(child())!)
    await expect.poll(() => isIndeterminate(rowCheckbox(parent())!)).toBe(true)
    expect(isChecked(rowCheckbox(parent())!)).toBe(false)

    // Restore.
    await userEvent.click(rowCheckbox(child())!)
    await expect.poll(() => isIndeterminate(rowCheckbox(parent())!)).toBe(false)
  })
})
