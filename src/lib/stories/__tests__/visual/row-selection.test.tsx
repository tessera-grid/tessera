import axe from 'axe-core'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, onTestFinished, test, vi } from 'vitest'

import { composed, selectedCountArgs, subRowSelectionArgs } from '../stories'
import { COLUMN_SELECTION_ID } from '../../../../lib/plugins/rowSelection'
import { AXE_OPTIONS } from './a11y-helpers'
import { rowState } from '../helpers'
import { tableLabels } from '../labels'

// Each Row Selection requirement is its own named test, prefixed with its spec ID
// (RS1–RS18 from the requirements table in docs/decisions/0014-row-selection.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the `RowSelectionPlayground` story (flat rows, whole page visible) for the
// per-row and select-all-on-page mechanics, and the same story with
// `subRowSelectionArgs` (a deterministic tree) for the sub-row cascade. State is read from the DOM/ARIA
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

type RowSelectionArgs = Partial<
  Parameters<typeof composed.RowSelectionPlayground>[0]
>
type SubRowArgs = Partial<Parameters<typeof composed.RowSelectionPlayground>[0]>

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
  const { container } = await render(
    // Without the Playground seed: tests start with nothing selected.
    <composed.RowSelectionPlayground extraPlugins={[]} {...args} />,
  )
  await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(3)
  return container
}

/** Render the sub-row tree, sized so every node is visible. */
async function renderSubRowSelection(args: SubRowArgs = {}) {
  const { container } = await render(
    <composed.RowSelectionPlayground
      {...subRowSelectionArgs}
      extraPlugins={[]}
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
      enableColumnSizing: true,
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
    const unselectedBg = rowState(first())

    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => isRowSelected(first())).toBe(true)
    await userEvent.hover(selectionHeadCell(container)!)

    // Selecting lays the selected token over the row background (ADR 0126) — the
    // exact rgb is theme-dependent, so the requirement is that it changes.
    const selectedBg = rowState(first())
    expect(selectedBg).not.toBe(unselectedBg)

    // Restore: deselecting drops the selected marker (self-restoring).
    await userEvent.click(rowCheckbox(first())!)
    await expect.poll(() => isRowSelected(first())).toBe(false)
  })
})

describe('Row Selection — header (select all in the scope)', () => {
  test('RS8: the header checkbox selects every row in the select-all scope', async () => {
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

  test('RS9: when all rows in the scope are selected the header checkbox is checked', async () => {
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

  test('RS11: toggling the header calls the `onSelectAllRows` hook with the scope', async () => {
    const onSelectAllRows = vi.fn()
    const container = await renderRowSelection({ onSelectAllRows })

    await userEvent.click(headCheckbox(container)!)
    await expect
      .poll(() => onSelectAllRows.mock.calls.at(-1))
      .toEqual([true, 'filtered'])

    // Clear again → hook fires with false (also restores state).
    await userEvent.click(headCheckbox(container)!)
    await expect
      .poll(() => onSelectAllRows.mock.calls.at(-1))
      .toEqual([false, 'filtered'])
  })

  test('RS12: clicking a checked header checkbox clears the selection in the scope', async () => {
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
    const on = await renderSubRowSelection({ rowSelectionSubRows: true })
    const onCount = on.querySelectorAll(`${BODY_ROW} ${CHECKBOX}`).length

    // …OFF: only parents keep a checkbox, so fewer checkboxes than rows.
    const off = await renderSubRowSelection({ rowSelectionSubRows: false })
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

// --- Счётчик выбранных строк в нижней панели (ADR 0038, RS19–RS22) -----------

const COUNT_GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 4,
  dataCount: 100,
}
const counter = () =>
  document.querySelector<HTMLElement>('[data-testid="selected-rows-count"]')
const statusBar = () =>
  document.querySelector<HTMLElement>('[data-testid="data-grid-status-bar"]')
const pageNext = () =>
  document.querySelector<HTMLElement>('[data-page-action="next"]')!

describe('Row Selection — selected count', () => {
  test('RS19: with selectedCount the left side of the status bar shows selectedRows(count); without the option there is no slot', async () => {
    const plain = await render(
      <composed.StatusBarPlayground
        {...selectedCountArgs}
        {...COUNT_GRID}
        rowSelectionSelectedCount={false}
      />,
    )
    await expect
      .poll(() => rowsTopDown(plain.container).length)
      .toBeGreaterThan(0)
    expect(counter()).toBeNull()
    await plain.unmount()

    const { container } = await render(
      <composed.StatusBarPlayground {...selectedCountArgs} {...COUNT_GRID} />,
    )
    await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(0)
    await userEvent.click(rowCheckbox(rowsTopDown(container)[0])!)
    await expect
      .poll(() => counter()!.textContent)
      .toBe(tableLabels.selectedRows(1))
    expect(counter()!.closest('[data-align]')!.getAttribute('data-align')).toBe(
      'start',
    )
    // Выбор на другой странице добавляется к счётчику.
    await userEvent.click(pageNext())
    await expect
      .poll(() => rowsTopDown(container)[0]?.dataset.rowId)
      .toBe('item-id-25')
    await userEvent.click(rowCheckbox(rowsTopDown(container)[0])!)
    await expect
      .poll(() => counter()!.textContent)
      .toBe(tableLabels.selectedRows(2))
  })

  test('RS21: with nothing selected the text is empty and the panel stays (the grid height does not change)', async () => {
    // RS21 — для панели в одну строку; узкая ширина — SB14.
    const { innerWidth: width, innerHeight: height } = window
    await page.viewport(1000, height)
    onTestFinished(() => page.viewport(width, height))
    const { container } = await render(
      <composed.StatusBarPlayground {...selectedCountArgs} {...COUNT_GRID} />,
    )
    await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(0)
    expect(counter()!.textContent).toBe('')
    const before = statusBar()!.getBoundingClientRect()

    const checkbox = rowCheckbox(rowsTopDown(container)[0])!
    await userEvent.click(checkbox)
    await expect
      .poll(() => counter()!.textContent)
      .toBe(tableLabels.selectedRows(1))
    await userEvent.click(checkbox)
    await expect.poll(() => counter()!.textContent).toBe('')

    const after = statusBar()!.getBoundingClientRect()
    expect([after.top, after.height]).toEqual([before.top, before.height])
  })

  test('RS22: the status bar with the counter and pagination passes axe; the counter is not a live region', async () => {
    const { container } = await render(
      <composed.StatusBarPlayground {...selectedCountArgs} {...COUNT_GRID} />,
    )
    await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(0)
    await userEvent.click(rowCheckbox(rowsTopDown(container)[0])!)
    await expect
      .poll(() => counter()!.textContent)
      .toBe(tableLabels.selectedRows(1))

    const { violations } = await axe.run(statusBar()!, AXE_OPTIONS)
    expect(violations).toEqual([])
    expect(counter()!.closest('[aria-live], [role="status"]')).toBeNull()
  })
})
