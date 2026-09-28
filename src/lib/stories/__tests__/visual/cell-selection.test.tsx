import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed } from '../stories'

// Каждое требование cellSelection — свой именованный тест `CR<n>` (таблица
// требований в docs/decisions/0029-cell-range-selection.md), чтобы `npm test`
// сообщал и валил их по отдельности (правило именования — ADR 0009).
// Тесты гоняют историю `CellSelection` (умеренный грид, обе оси в окне) и читают
// состояние из DOM-контракта: ячейка `data-cell-selected` / `data-cell-focused`,
// кромки — из инлайн-переменных `--tsr-sel-edge-*`. Взаимодействие — нативные
// MouseEvent'ы (детерминированно, как DnD-хореография в других тестах): стоковые
// хендлеры фичи читают модификаторы из `nativeEvent`.

// --- Selectors (part of the component contract) -------------------------------

const BODY_ROW = '.data-grid__body-row'
const BODY_CELL = '.data-grid__body-cell'
const SCROLL_CONTAINER = '[data-resizing]'

// --- DOM helpers --------------------------------------------------------------

/** Body rows in visual (top-to-bottom) order — real rows only (skip padding). */
const rowsTopDown = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(BODY_ROW))
    .filter(row => row.getAttribute('data-index') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )

/** Selectable body cells of a row, in visual left-to-right order. */
const cellsLeftRight = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLElement>(BODY_CELL))
    .filter(c => c.getAttribute('data-column-id'))
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

/** Cell at visual (rowIndex, colIndex). */
const cellAt = (container: HTMLElement, r: number, c: number) =>
  cellsLeftRight(rowsTopDown(container)[r])[c]

const isSelected = (cell: Element) =>
  cell.getAttribute('data-cell-selected') === 'true'
const isFocused = (cell: Element) =>
  cell.getAttribute('data-cell-focused') === 'true'
const selectedCount = (container: HTMLElement) =>
  container.querySelectorAll(`${BODY_CELL}[data-cell-selected='true']`).length
const edge = (cell: HTMLElement, side: string) =>
  cell.style.getPropertyValue(`--tsr-sel-edge-${side}`).trim()

// --- Mouse choreography -------------------------------------------------------

const fireMouse = (
  el: Element | Document,
  type: string,
  init: MouseEventInit = {},
) =>
  el.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, ...init }),
  )

/** Plain / shift / ctrl click on a cell (mousedown→mouseup). */
const clickCell = (cell: Element, init: MouseEventInit = {}) => {
  fireMouse(cell, 'mousedown', init)
  fireMouse(document, 'mouseup', init)
}

/** Drag from `start` across `path`, ending with a document mouseup.
 * Uses `mouseover` (bubbles) — React synthesizes `onMouseEnter` from it; a raw
 * `mouseenter` dispatch would NOT trigger the React handler. */
const dragCells = (start: Element, path: Element[]) => {
  fireMouse(start, 'mousedown')
  for (const cell of path) {
    fireMouse(cell, 'mouseover')
  }
  fireMouse(document, 'mouseup')
}

// --- Rendering ----------------------------------------------------------------

type CellSelectionArgs = Partial<Parameters<typeof composed.CellSelection>[0]>

async function renderCellSelection(args: CellSelectionArgs = {}) {
  const { container } = await render(<composed.CellSelection {...args} />)
  await expect.poll(() => rowsTopDown(container).length).toBeGreaterThan(3)
  return container
}

// --- Requirements (CR1–CR12) --------------------------------------------------

describe('Cell Selection — activation', () => {
  test('CR9: the plugin is inert without `enableCellSelection`', async () => {
    const container = await renderCellSelection({ enableCellSelection: false })
    // No selection attributes, no roving tabindex, and clicking does nothing.
    expect(container.querySelector('[data-cell-selected]')).toBeNull()
    expect(cellAt(container, 0, 0).hasAttribute('tabindex')).toBe(false)
    clickCell(cellAt(container, 0, 0))
    expect(container.querySelector('[data-cell-selected]')).toBeNull()
  })

  test('CR14: selectable cells suppress native text selection (user-select: none)', async () => {
    const container = await renderCellSelection()
    // Клик/shift/drag должны выделять ЯЧЕЙКИ, а не текст: выбираемая ячейка
    // (несёт roving tabindex) отключает нативное выделение текста.
    const cell = cellAt(container, 0, 0)
    expect(cell.hasAttribute('tabindex')).toBe(true)
    expect(getComputedStyle(cell).userSelect).toBe('none')
  })
})

describe('Cell Selection — mouse', () => {
  test('CR1: clicking a cell selects it alone and focuses it', async () => {
    const container = await renderCellSelection()
    clickCell(cellAt(container, 0, 0))
    await expect.poll(() => selectedCount(container)).toBe(1)
    expect(isSelected(cellAt(container, 0, 0))).toBe(true)
    expect(isFocused(cellAt(container, 0, 0))).toBe(true)

    // Clicking another cell moves the whole selection.
    clickCell(cellAt(container, 1, 1))
    await expect.poll(() => isSelected(cellAt(container, 1, 1))).toBe(true)
    expect(selectedCount(container)).toBe(1)
    expect(isSelected(cellAt(container, 0, 0))).toBe(false)
  })

  test('CR2: shift-click extends a rectangular range from the anchor', async () => {
    const container = await renderCellSelection()
    clickCell(cellAt(container, 0, 0))
    clickCell(cellAt(container, 1, 2), { shiftKey: true })
    // rows {0,1} × cols {0,1,2} = 6 cells.
    await expect.poll(() => selectedCount(container)).toBe(6)
    expect(isSelected(cellAt(container, 0, 0))).toBe(true)
    expect(isSelected(cellAt(container, 1, 2))).toBe(true)
    // The anchor stays the focused cell.
    expect(isFocused(cellAt(container, 0, 0))).toBe(true)
  })

  test('CR3: dragging across cells selects the swept rectangle', async () => {
    const container = await renderCellSelection()
    dragCells(cellAt(container, 0, 0), [
      cellAt(container, 0, 1),
      cellAt(container, 1, 1),
    ])
    // rows {0,1} × cols {0,1} = 4 cells.
    await expect.poll(() => selectedCount(container)).toBe(4)
    expect(isSelected(cellAt(container, 0, 0))).toBe(true)
    expect(isSelected(cellAt(container, 1, 1))).toBe(true)
  })

  test('CR16: dragging past the edge auto-scrolls and extends the selection', async () => {
    const container = await renderCellSelection()
    const scroller = container.querySelector<HTMLElement>(SCROLL_CONTAINER)!
    const rect = scroller.getBoundingClientRect()

    // Begin a drag on the top-left cell, then hold the pointer BELOW the bottom
    // edge — the rAF loop must scroll the container and extend the range.
    fireMouse(cellAt(container, 0, 0), 'mousedown')
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: rect.left + 20,
        clientY: rect.bottom + 60,
      }),
    )
    await expect
      .poll(() => scroller.scrollTop, { timeout: 2000 })
      .toBeGreaterThan(0)
    await expect.poll(() => selectedCount(container)).toBeGreaterThan(1)
    fireMouse(document, 'mouseup')
  })

  test('CR4: ctrl/cmd-click adds a separate rectangle (multi-range)', async () => {
    const container = await renderCellSelection()
    clickCell(cellAt(container, 0, 0))
    clickCell(cellAt(container, 2, 2), { ctrlKey: true })
    await expect.poll(() => selectedCount(container)).toBe(2)
    expect(isSelected(cellAt(container, 0, 0))).toBe(true)
    expect(isSelected(cellAt(container, 2, 2))).toBe(true)
    // A cell between the two disjoint rectangles is NOT selected.
    expect(isSelected(cellAt(container, 1, 1))).toBe(false)
  })

  test('CR5: selected cells carry boundary edges; the anchor is focused', async () => {
    const container = await renderCellSelection()
    clickCell(cellAt(container, 0, 0))
    clickCell(cellAt(container, 1, 1), { shiftKey: true })
    await expect.poll(() => selectedCount(container)).toBe(4)

    // Top-left corner of a 2×2 range: outer edges on top & left, interior on
    // right & bottom (neighbour is selected → transparent).
    const topLeft = cellAt(container, 0, 0)
    expect(edge(topLeft, 'top')).not.toBe('transparent')
    expect(edge(topLeft, 'left')).not.toBe('transparent')
    expect(edge(topLeft, 'right')).toBe('transparent')
    expect(edge(topLeft, 'bottom')).toBe('transparent')
    expect(isFocused(topLeft)).toBe(true)

    // Bottom-right corner: outer edges on right & bottom.
    const bottomRight = cellAt(container, 1, 1)
    expect(edge(bottomRight, 'right')).not.toBe('transparent')
    expect(edge(bottomRight, 'bottom')).not.toBe('transparent')
  })

  test('CR15: the anchor cell is not tinted (Excel/Sheets style); others are', async () => {
    const container = await renderCellSelection()
    clickCell(cellAt(container, 0, 0))
    clickCell(cellAt(container, 1, 1), { shiftKey: true })
    await expect.poll(() => selectedCount(container)).toBe(4)

    // Anchor (focused) stays un-filled so it reads as the active cell without a
    // detached border; the other selected cells carry the tint gradient.
    const anchor = cellAt(container, 0, 0)
    const other = cellAt(container, 1, 1)
    expect(isFocused(anchor)).toBe(true)
    expect(getComputedStyle(anchor).backgroundImage).toBe('none')
    expect(getComputedStyle(other).backgroundImage).not.toBe('none')
  })
})

describe('Cell Selection — clipboard (copy)', () => {
  test('CR6: Ctrl/Cmd+C copies the selection as TSV in row-major order', async () => {
    const container = await renderCellSelection()
    clickCell(cellAt(container, 0, 0))
    clickCell(cellAt(container, 1, 1), { shiftKey: true })
    await expect.poll(() => selectedCount(container)).toBe(4)

    const anchor = cellAt(container, 0, 0)
    const copy = new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    })
    anchor.dispatchEvent(copy)

    const tsv = copy.clipboardData!.getData('text/plain')
    const rows = tsv.split('\n')
    expect(rows).toHaveLength(2)
    expect(rows[0].split('\t')).toHaveLength(2)
    expect(rows[1].split('\t')).toHaveLength(2)
  })

  test('CR7: the copy also carries an HTML table (rich paste)', async () => {
    const container = await renderCellSelection()
    clickCell(cellAt(container, 0, 0))
    clickCell(cellAt(container, 0, 1), { shiftKey: true })
    await expect.poll(() => selectedCount(container)).toBe(2)

    const copy = new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    })
    cellAt(container, 0, 0).dispatchEvent(copy)

    expect(copy.clipboardData!.getData('text/html')).toContain('<table')
  })
})

describe('Cell Selection — virtualization', () => {
  test('CR12: selection survives vertical scroll (stored by model id)', async () => {
    const container = await renderCellSelection()
    const firstRow = rowsTopDown(container)[0]
    const rowId = firstRow.getAttribute('data-row-id')!
    const colId = cellsLeftRight(firstRow)[0].getAttribute('data-column-id')!

    clickCell(cellAt(container, 0, 0))
    await expect.poll(() => selectedCount(container)).toBe(1)

    const scroller = container.querySelector<HTMLElement>(SCROLL_CONTAINER)!
    // Scroll to the bottom — the selected top row unmounts under virtualization.
    scroller.scrollTop = scroller.scrollHeight
    scroller.dispatchEvent(new Event('scroll'))
    await expect
      .poll(() =>
        container.querySelector(`${BODY_ROW}[data-row-id='${rowId}']`),
      )
      .toBeNull()

    // Scroll back — the cell remounts and is still selected (id-based, not window).
    scroller.scrollTop = 0
    scroller.dispatchEvent(new Event('scroll'))
    await expect
      .poll(() => {
        const row = container.querySelector<HTMLElement>(
          `${BODY_ROW}[data-row-id='${rowId}']`,
        )
        const cell = row?.querySelector(`[data-column-id='${colId}']`)
        return cell ? isSelected(cell) : false
      })
      .toBe(true)
  })
})
