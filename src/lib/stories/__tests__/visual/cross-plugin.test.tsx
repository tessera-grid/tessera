import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import * as stories from '../../DataGrid.stories'
import {
  HANDLE,
  ROW,
  USER_CELL,
  beginDrag,
  firePointer,
  nextFrame,
  sortByIndex,
} from '../../rowDragging.dnd'

// Cross-plugin (сквозные) requirements live here, prefixed `X<n>`, one named test
// per requirement (docs/decisions/0023-cross-plugin-interactions.md). Unlike the
// single-plugin specs (RS*, D*), these drive a story with *several* plugins on at
// once and assert the behaviour of their seam in real DOM, reusing the shared DnD
// choreography (rowDragging.dnd.ts) and the selection DOM contract.

const composed = composeStories(stories)

/** The row/header selection checkbox (stable class on `SelectCheckbox`). */
const CHECKBOX = '.row-select-checkbox'

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
    <composed.RowDragging
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
