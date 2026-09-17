// Shared drag-and-drop mechanics for the Row Dragging plugin, used by BOTH the
// Storybook `play` scenario (DataGrid.stories.tsx) and the vitest requirement
// suite (__tests__/row-dragging.test.tsx). Keeping the pointer choreography in
// one place stops the story demo and the tests from drifting apart. Pure DOM /
// pointer utilities only — no assertion library, so each caller brings its own
// expect (storybook/test vs vitest).

/** Icon side per spec (`DragHandler.module.css`: `.button svg { 16px }`). */
export const DRAG_ICON_SIZE = 16
/** Column width per spec: icon (16) + left padding (4) + right padding (4). */
export const DRAG_COLUMN_WIDTH = DRAG_ICON_SIZE + 4 + 4 // = 24

export const ROW = '.data-grid__body-row'
export const USER_CELL =
  '.data-grid__body-cell:not([data-actions-column-cell="true"])'
export const HANDLE = '.drag__handler--column'
/** OverlayBodyRow container (the drag "cloud") — distinct class from body rows. */
export const OVERLAY = '.data-grid-body__row'
/** The row whose slot shows the colour drop-indicator while dragging. */
export const DRAG_FILL = '.data-grid__body-row[data-row-draggable="true"]'
/** The element that actually overflows and scrolls. */
export const SCROLLER = '.MuiTableContainer-root'

export const sortByIndex = (a: HTMLElement, b: HTMLElement) =>
  Number(a.getAttribute('data-index')) - Number(b.getAttribute('data-index'))

export const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

export const firePointer = (
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  target: Element | Document,
  x: number,
  y: number,
) => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  )
}

/** Rendered body rows, ordered by their virtual row index. */
export const sortedRows = (canvas: HTMLElement) =>
  Array.from(canvas.querySelectorAll<HTMLElement>(ROW)).sort(sortByIndex)

/** Visible order of rows keyed by a per-row signature (all user-cell text). */
export const rowSignatures = (canvas: HTMLElement) =>
  sortedRows(canvas).map(row =>
    Array.from(row.querySelectorAll<HTMLElement>(USER_CELL))
      .map(cell => cell.textContent?.trim() ?? '')
      .join('|'),
  )

/**
 * Visible row order keyed by STABLE `data-row-id` (row identity), not by cell text.
 * Reorder assertions must use this: only the virtualization window is in the DOM,
 * so a text/whole-window signature can differ on a window shift (auto-scroll) rather
 * than a real reorder. Row id follows the row across a move.
 */
export const rowIdOrder = (canvas: HTMLElement) =>
  sortedRows(canvas).map(row => row.getAttribute('data-row-id'))

/** Press on a row handle and pass the activation move; pointer stays down. */
export const beginDrag = async (handle: HTMLElement) => {
  const hr = handle.getBoundingClientRect()
  const hx = hr.left + hr.width / 2
  const hy = hr.top + hr.height / 2
  firePointer('pointerdown', handle, hx, hy)
  await nextFrame()
  firePointer('pointermove', document, hx, hy + 6)
  await nextFrame()
  await nextFrame()
  await nextFrame()
  return { hx, hy }
}

/** Drag `sourceRow`'s handle onto `targetRow`'s vertical centre and drop. */
export const dragRowOnto = async (
  sourceRow: HTMLElement,
  targetRow: HTMLElement,
) => {
  const handle = sourceRow.querySelector<HTMLElement>(HANDLE)!
  const { hx } = await beginDrag(handle)
  const tr = targetRow.getBoundingClientRect()
  const ty = tr.top + tr.height / 2
  firePointer('pointermove', document, hx, ty)
  await nextFrame()
  await nextFrame()
  firePointer('pointermove', document, hx, ty + 1)
  await nextFrame()
  await nextFrame()
  firePointer('pointerup', document, hx, ty + 1)
}
