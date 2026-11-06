import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { humanClick } from '../helpers'

import { ENGLISH_LABELS } from '../../../core/localization'
import { composed, plainGroupingArgs } from '../stories'
import { COLUMN_SELECTION_ID } from '../../../../lib/plugins/rowSelection'
import {
  HANDLE,
  ROW,
  USER_CELL,
  beginDrag,
  firePointer,
  nextFrame,
  sortByIndex,
} from '../../rowDragging.dnd'
import { tableLabels } from '../labels'
import { ColumnDraggingGrid } from './columns-fixtures'
import { columnPinningLabels } from '../../../plugins/columnPinning/labels'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'
import { rowGroupingLabels } from '../../../plugins/rowGrouping/labels'
import { rowDraggingLabels } from '../../../plugins/rowDragging/labels'

// Cross-plugin (сквозные) requirements live here, prefixed `X<n>`, one named test
// per requirement (docs/decisions/0023-cross-plugin-interactions.md). Unlike the
// single-plugin specs (RS*, D*), these drive a story with *several* plugins on at
// once and assert the behaviour of their seam in real DOM, reusing the shared DnD
// choreography (rowDragging.dnd.ts) and the selection DOM contract.

/** The row/header selection checkbox (stable class on `SelectCheckbox`). */
const CHECKBOX = '.row-select-checkbox'

const HEAD_CELL = '.data-grid__head-cell'
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`
const KEBAB = `[aria-label="${tableLabels.headerMenu}"]`
const ROW_KEBAB = `[aria-label="${tableLabels.rowMenu}"]`
const ACTION_CELL =
  '.data-grid__body-cell[data-column-id="actionColumn__rowActions"]'

const menuTexts = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
    i => i.textContent?.trim(),
  )

/** Body rows ordered by their virtual index. */
const sortedRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(ROW)).sort(sortByIndex)

/** A per-row identity signature: the text of all its user (non-service) cells. */
const signatureOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLElement>(USER_CELL))
    .map(cell => cell.textContent?.trim() ?? '')
    .join('|')

const isRowSelected = (row: HTMLElement) =>
  row.getAttribute('data-selected') === 'true'

const rowBySignature = (container: HTMLElement, signature: string) =>
  sortedRows(container).find(row => signatureOf(row) === signature)

/**
 * Render the Row Dragging story with row selection also enabled, sized so a small
 * set of rows fits without vertical scroll — the reorder is deterministic and no
 * auto-scroll interferes.
 */
async function renderSelectableDraggable() {
  const { container } = await render(
    <composed.RowDraggingPlayground
      enableRowSelection
      dataCount={12}
      containerHeight={620}
      height={520}
      maxHeight={520}
    />,
  )
  await expect.poll(() => sortedRows(container).length).toBeGreaterThan(4)
  // Both service columns are present: a drag handle and a selection checkbox.
  await expect.poll(() => container.querySelector(HANDLE) !== null).toBe(true)
  await expect.poll(() => container.querySelector(CHECKBOX) !== null).toBe(true)
  return container
}

describe('Cross-plugin — rowSelection × rowDragging', () => {
  test('X1: selection survives a drag — the same row (by id) stays selected, not the slot', async () => {
    const container = await renderSelectableDraggable()

    // Select the top row and remember WHICH row it is (its identity signature).
    const source = sortedRows(container)[0]
    const selectedSignature = signatureOf(source)
    await userEvent.click(source.querySelector<HTMLElement>(CHECKBOX)!)
    await expect
      .poll(() => isRowSelected(rowBySignature(container, selectedSignature)!))
      .toBe(true)

    // Drag that same row down onto the 4th slot and drop.
    const target = sortedRows(container)[3]
    const { hx } = await beginDrag(source.querySelector<HTMLElement>(HANDLE)!)
    const tr = target.getBoundingClientRect()
    const ty = tr.top + tr.height / 2
    firePointer('pointermove', document, hx, ty)
    await nextFrame()
    await nextFrame()
    firePointer('pointermove', document, hx, ty + 1)
    await nextFrame()
    await nextFrame()
    firePointer('pointerup', document, hx, ty + 1)

    // The selected row actually moved off slot 0 (order changed)…
    await expect
      .poll(() => signatureOf(sortedRows(container)[0]) !== selectedSignature)
      .toBe(true)

    // …and selection followed the row's IDENTITY, not its old slot:
    // the original row is still selected wherever it landed,
    const moved = rowBySignature(container, selectedSignature)!
    expect(isRowSelected(moved)).toBe(true)
    // and the row now occupying slot 0 is NOT selected.
    expect(isRowSelected(sortedRows(container)[0])).toBe(false)
  })
})

describe('Cross-plugin — headerActionMenu × rowActionMenu', () => {
  test('X2: header and row kebabs collapse independently — both menus work', async () => {
    const { container } = await render(
      <composed.DataGridPlayground
        enableColumnPinning
        enableColumnSorting
        enableRowGrouping
        enableHeaderActionMenu
        enableRowActions
        enableRowActionMenu
        dataCount={20}
        containerHeight={500}
        height={400}
        maxHeight={400}
      />,
    )

    // Header actions collapsed to per-column kebabs, no inline plugin buttons.
    await expect
      .poll(
        () => container.querySelectorAll(`${DATA_HEAD_CELL} ${KEBAB}`).length,
      )
      .toBeGreaterThan(0)
    expect(
      container.querySelectorAll(`${HEAD_CELL} .column-pin__button`).length,
    ).toBe(0)

    // Row actions collapsed to a per-row kebab in the actions column.
    const actionCell = container.querySelector<HTMLElement>(ACTION_CELL)!
    expect(actionCell.querySelector(ROW_KEBAB)).toBeTruthy()

    // Header kebab opens the column controls…
    const headKebab = container.querySelector<HTMLElement>(
      `${DATA_HEAD_CELL} ${KEBAB}`,
    )!
    await humanClick(headKebab)
    await expect
      .poll(() => menuTexts())
      .toEqual(
        expect.arrayContaining([
          columnPinningLabels(tableLabels).pin,
          columnSortingLabels(tableLabels).sortAscending,
          rowGroupingLabels(tableLabels).group,
        ]),
      )
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => menuTexts().length).toBe(0)

    // …and the row kebab independently opens the row actions.
    await humanClick(actionCell.querySelector<HTMLElement>(ROW_KEBAB)!)
    await expect
      .poll(() => menuTexts())
      .toEqual(expect.arrayContaining(['Edit', 'Duplicate', 'Delete']))
    await userEvent.keyboard('{Escape}')

    // Header kebabs are untouched by the row menu interaction.
    expect(
      container.querySelectorAll(`${DATA_HEAD_CELL} ${KEBAB}`).length,
    ).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Header-control seams (X3–X6). These drive two enabled plugins that share a
// header cell, a sticky offset chain or the row model, and assert the seam in
// real DOM. Selectors and choreography mirror the owning plugins' own specs
// (column-pinning / column-resizing / column-sorting / column-dragging /
// row-grouping / row-selection) so the cross-plugin tests read the same DOM
// contract those suites do, not mock literals.
// ---------------------------------------------------------------------------

const BODY_ROW = '.data-grid__body-row'
/** ColumnPinning pin toggle, per pinnable header. */
const PIN_BUTTON = '.column-pin__button'
/** ColumnSizing resize grip, per resizable header. */
const RESIZE_GRIP = '.resize__handler--column'
/** ColumnSorting sort toggle, per sortable header. */
const SORT_BUTTON = '.column-sort__button'
/** RowGrouping group toggle, per groupable header. */
const GROUP_BUTTON = '.column-group__button'

/** A header cell addressed by its logical column id. */
const headCellById = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL}[data-column-id='${id}']`)!

/** Rendered data-column header cells, in visual (left-to-right) order. */
const renderedDataCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(DATA_HEAD_CELL))
    // real columns carry aria-colindex; virtualization padding divs do not
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

/**
 * The hover-hidden wrapper around a header control. It carries
 * `data-button-active`, so it is found structurally regardless of the (hashed)
 * module class — the element `buttonVisibility.css` toggles opacity on.
 */
const hiddenWrapperOf = (button: HTMLElement) =>
  button.closest<HTMLElement>('[data-button-active]')!

/** Hover a header to reveal one of its hover-hidden controls, then return it. */
const revealControl = async (cell: HTMLElement, selector: string) => {
  await userEvent.hover(cell)
  const button = cell.querySelector<HTMLElement>(selector)!
  await expect
    .poll(() => getComputedStyle(hiddenWrapperOf(button)).opacity)
    .toBe('1')
  return button
}

/** Menu items of the currently open pin popover (role=menuitem). */
const menuItemByText = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    item => item.textContent?.trim() === text,
  )

/** The header select-all checkbox, or null when it isn't rendered. */
const headCheckbox = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(`${HEAD_CELL} ${CHECKBOX}`)

/** Visible group rows, top-to-bottom (real rows only, skip padding). */
const groupRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(BODY_ROW))
    .filter(
      row =>
        row.getAttribute('data-index') !== null &&
        row.getAttribute('data-group-row') === 'true',
    )
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )

// --- Synthetic mouse choreography for the resize grip -------------------------
// TanStack's resize handler reads clientX off a mousedown, then off document
// mousemoves, and ends on document mouseup (columnResizeMode 'onChange'), so the
// pinned offset re-flows live. Mirrors column-resizing.test.tsx.
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

/** Full grip drag: press, move by `dx` px, release. */
const resizeBy = async (grip: HTMLElement, dx: number) => {
  const r = grip.getBoundingClientRect()
  const x0 = r.left + r.width / 2
  const y = r.top + r.height / 2
  fireMouse('mousedown', grip, x0, y)
  await nextFrame()
  fireMouse('mousemove', document, x0 + dx, y)
  await nextFrame()
  await nextFrame()
  fireMouse('mousemove', document, x0 + dx, y)
  await nextFrame()
  fireMouse('mouseup', document, x0 + dx, y)
  await nextFrame()
  await nextFrame()
}

// --- Column-drag choreography (horizontal activation, head-cell targets) ------
// Mirrors column-dragging.test.tsx; the PointerEvent plumbing is the shared
// rowDragging.dnd primitive, only the axis (horizontal) is column-specific.
const beginColumnDrag = async (handle: HTMLElement) => {
  const hr = handle.getBoundingClientRect()
  const hx = hr.left + hr.width / 2
  const hy = hr.top + hr.height / 2
  firePointer('pointerdown', handle, hx, hy)
  await nextFrame()
  firePointer('pointermove', document, hx + 6, hy)
  await nextFrame()
  await nextFrame()
  await nextFrame()
  return { hx, hy }
}

/** Drag `source`'s header handle over `target`'s centre and drop. */
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

describe('Cross-plugin — columnPinning × columnSizing', () => {
  test('X3: resizing a left-pinned column re-flows the next pinned column’s sticky offset', async () => {
    const { container } = await render(
      <composed.ColumnPinningPlayground enableColumnSizing dataCount={40} />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)

    // Pin two data columns left: `country` is one-sided (direct toggle), while
    // `firstName` is both-sided (pin via its inline popover). `country` is
    // defined first, so it leads the left block and `firstName` chains after it.
    await userEvent.click(
      await revealControl(headCellById(container, 'country'), PIN_BUTTON),
    )
    await expect
      .poll(() =>
        headCellById(container, 'country').getAttribute('data-cell-pinned'),
      )
      .toBe('left')

    await userEvent.click(
      await revealControl(headCellById(container, 'firstName'), PIN_BUTTON),
    )
    await expect
      .poll(() => menuItemByText(columnPinningLabels(tableLabels).pinLeft))
      .toBeTruthy()
    await userEvent.click(
      menuItemByText(columnPinningLabels(tableLabels).pinLeft)!,
    )
    await expect
      .poll(() =>
        headCellById(container, 'firstName').getAttribute('data-cell-pinned'),
      )
      .toBe('left')

    // firstName sits to the right of country → its sticky offset is > 0 (chained
    // behind the leading pinned column, not flush at the edge).
    const secondBefore = parseFloat(
      getComputedStyle(headCellById(container, 'firstName')).left,
    )
    expect(secondBefore).toBeGreaterThan(0)

    // Widen the leading pinned column; the following pinned column's sticky
    // `left` grows by the same delta — the offset chain runs through columnSizing.
    await resizeBy(
      await revealControl(headCellById(container, 'country'), RESIZE_GRIP),
      140,
    )

    await expect
      .poll(() =>
        parseFloat(getComputedStyle(headCellById(container, 'firstName')).left),
      )
      .toBeGreaterThan(secondBefore + 100)
  })
})

describe('Cross-plugin — columnPinning × rowSelection', () => {
  test('X4: the leading selection column joins the left-pinned block and offsets the user-pinned column', async () => {
    const { container } = await render(
      <composed.ColumnPinningPlayground enableRowSelection dataCount={40} />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)

    const selectionHead = () => headCellById(container, COLUMN_SELECTION_ID)

    // Before any user pin the leading selection service column is not left-pinned.
    expect(selectionHead().getAttribute('data-cell-pinned')).not.toBe('left')

    // Pin a data column left → the selection column joins the left block (CP14b).
    await userEvent.click(
      await revealControl(headCellById(container, 'country'), PIN_BUTTON),
    )
    await expect
      .poll(() => selectionHead().getAttribute('data-cell-pinned'))
      .toBe('left')

    // The selection column leads at the very edge (offset 0)…
    expect(getComputedStyle(selectionHead()).position).toBe('sticky')
    expect(getComputedStyle(selectionHead()).left).toBe('0px')

    // …and the user-pinned data column stacks to its right, offset by exactly the
    // selection column's width: the two plugins share ONE sticky offset chain.
    const country = headCellById(container, 'country')
    expect(getComputedStyle(country).position).toBe('sticky')
    const countryLeft = parseFloat(getComputedStyle(country).left)
    const selectionWidth = selectionHead().getBoundingClientRect().width
    expect(countryLeft).toBeGreaterThan(0)
    expect(Math.abs(countryLeft - selectionWidth)).toBeLessThan(2)
  })
})

describe('Cross-plugin — columnDragging × columnSorting', () => {
  test('X5: a header sorts on click and keeps its sort after being dragged to a new position', async () => {
    const { container } = await render(
      <ColumnDraggingGrid enableColumnSorting dataCount={40} />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)

    // A data header carries BOTH controls at once (drag handle in the gutter,
    // sort toggle at the trailing edge) — the two plugins coexist in one cell.
    const source = renderedDataCells(container)[1]
    const sourceId = source.getAttribute('data-column-id')!
    expect(source.querySelector(HANDLE)).not.toBeNull()
    expect(source.querySelector(SORT_BUTTON)).not.toBeNull()

    // Clicking the sort toggle sorts the column — the drag plugin does not
    // swallow the click (the controls are spatially disjoint).
    await userEvent.click(await revealControl(source, SORT_BUTTON))
    await expect
      .poll(() => headCellById(container, sourceId).getAttribute('aria-sort'))
      .toBe('descending')

    // Drag that same column onto a later one → the visible column order changes.
    const before = renderedDataCells(container).map(c =>
      c.getAttribute('data-column-id'),
    )
    const srcIdx = before.indexOf(sourceId)
    const target =
      renderedDataCells(container)
        .slice(srcIdx + 1)
        .find(c => c.getAttribute('data-column-id') !== sourceId) ??
      renderedDataCells(container).at(-1)!
    await dragColumnOnto(headCellById(container, sourceId), target)

    await expect
      .poll(
        () =>
          renderedDataCells(container)
            .map(c => c.getAttribute('data-column-id'))
            .join('¦') !== before.join('¦'),
      )
      .toBe(true)

    // Sort is keyed to the column's identity, not its slot — the moved column
    // stays sorted where it landed.
    expect(headCellById(container, sourceId).getAttribute('aria-sort')).toBe(
      'descending',
    )
  })
})

describe('Cross-plugin — rowSelection × rowGrouping', () => {
  test('X6: row selection works with the grouping plugin enabled, under active grouping and after ungrouping', async () => {
    const { container } = await render(
      <composed.RowGroupingPlayground
        {...plainGroupingArgs}
        enableRowSelection
      />,
    )
    await expect
      .poll(() => container.querySelectorAll(BODY_ROW).length)
      .toBeGreaterThan(3)

    // Grouping is enabled but NOT applied → selection works: the header select-all
    // and per-row checkboxes are present. Presence of the grouping plugin alone
    // must not disable another plugin.
    expect(headCheckbox(container)).not.toBeNull()
    expect(
      container.querySelectorAll(`${BODY_ROW} ${CHECKBOX}`).length,
    ).toBeGreaterThan(0)

    // Apply grouping by a low-cardinality column → the visible rows become groups.
    await userEvent.click(
      await revealControl(headCellById(container, 'gender'), GROUP_BUTTON),
    )
    await expect.poll(() => groupRows(container).length).toBeGreaterThan(1)

    // Under ACTIVE grouping selection stays (ADR 0185): the header select-all and
    // the checkboxes of group rows are present.
    expect(headCheckbox(container)).not.toBeNull()
    await expect
      .poll(() => container.querySelectorAll(`${BODY_ROW} ${CHECKBOX}`).length)
      .toBeGreaterThan(0)

    // Ungroup → selection is still there.
    await userEvent.click(
      await revealControl(headCellById(container, 'gender'), GROUP_BUTTON),
    )
    await expect
      .poll(() => container.querySelector(CHECKBOX) !== null)
      .toBe(true)
  })
})

// --- Пагинация × другие плагины (ADR 0038, X7–X10) ----------------------------

const PAGED = {
  containerHeight: 600,
  height: 500,
  columnCount: 5,
  dataCount: 100,
  enablePagination: true,
}

const pageRange = () =>
  document.querySelector<HTMLElement>('[data-testid="pagination-range"]')!
    .textContent
const pageButton = (action: 'previous' | 'next') =>
  document.querySelector<HTMLElement>(`[data-page-action="${action}"]`)!
const firstPagedRow = (container: HTMLElement) => sortedRows(container)[0]

async function renderPaged(extra: object) {
  const { container } = await render(
    <composed.PaginationPlayground {...PAGED} {...extra} />,
  )
  await expect.poll(() => sortedRows(container).length).toBeGreaterThan(4)
  await expect.poll(pageRange).toBe('1–25 of 100')
  return container
}

async function toSecondPage(container: HTMLElement) {
  await userEvent.click(pageButton('next'))
  await expect.poll(pageRange).toBe('26–50 of 100')
  await expect
    .poll(() => firstPagedRow(container)?.dataset.rowId)
    .toBe('item-id-25')
}

describe('Cross-plugin — pagination', () => {
  test("X7: with the 'currentPage' scope the selection by id survives a page change and comes back on the previous page", async () => {
    const container = await renderPaged({
      enableRowSelection: true,
      rowSelectionSelectAll: 'currentPage',
    })
    const headCheckbox = container.querySelector<HTMLElement>(
      `${HEAD_CELL} ${CHECKBOX}`,
    )!
    await userEvent.click(headCheckbox)
    await expect
      .poll(() => sortedRows(container).every(isRowSelected))
      .toBe(true)

    await toSecondPage(container)
    expect(sortedRows(container).some(isRowSelected)).toBe(false)

    await userEvent.click(pageButton('previous'))
    await expect.poll(pageRange).toBe('1–25 of 100')
    await expect
      .poll(() => sortedRows(container).every(isRowSelected))
      .toBe(true)
  })

  test('X8: a saved cell edit keeps the current page', async () => {
    const container = await renderPaged({ enableCellEditing: true })
    await toSecondPage(container)

    const cell = () =>
      firstPagedRow(container).querySelector<HTMLElement>(
        '.data-grid__body-cell[data-column-id="age"]',
      )!
    await userEvent.hover(cell())
    await humanClick(cell().querySelector<HTMLElement>('.cell__button button')!)
    const input = await expect
      .poll(() => cell().querySelector<HTMLInputElement>('input'))
      .not.toBeNull()
      .then(() => cell().querySelector<HTMLInputElement>('input')!)
    await userEvent.clear(input)
    await userEvent.type(input, '77{Enter}')

    await expect.poll(() => cell().textContent).toContain('77')
    expect(pageRange()).toBe('26–50 of 100')
  })

  test('X9: reordering a row within the page keeps the current page', async () => {
    const container = await renderPaged({ enableRowDragging: true })
    await toSecondPage(container)

    const moved = firstPagedRow(container).dataset.rowId!
    const row = () =>
      container.querySelector<HTMLElement>(`${ROW}[data-row-id="${moved}"]`)!
    row().querySelector<HTMLElement>(HANDLE)!.focus()
    await userEvent.keyboard('{Enter}')
    const moveDown = await expect
      .poll(() =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          item =>
            item.textContent?.trim() ===
            rowDraggingLabels(ENGLISH_LABELS).moveDown,
        ),
      )
      .toBeTruthy()
      .then(() =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          item =>
            item.textContent?.trim() ===
            rowDraggingLabels(ENGLISH_LABELS).moveDown,
        )!,
      )
    await userEvent.click(moveDown)

    await expect.poll(() => row().dataset.index).toBe('1')
    expect(pageRange()).toBe('26–50 of 100')
  })

  test('X10: the cell range selection is reset on a page change', async () => {
    const container = await renderPaged({ enableCellSelection: true })
    const cell = firstPagedRow(container).querySelector<HTMLElement>(
      '.data-grid__body-cell[data-column-id="age"]',
    )!
    await userEvent.click(cell)
    await expect
      .poll(() => container.querySelectorAll('[data-cell-selected]').length)
      .toBeGreaterThan(0)

    await toSecondPage(container)
    await expect
      .poll(() => container.querySelectorAll('[data-cell-selected]').length)
      .toBe(0)
    await userEvent.click(pageButton('previous'))
    await expect.poll(pageRange).toBe('1–25 of 100')
    expect(container.querySelectorAll('[data-cell-selected]').length).toBe(0)
  })
})
