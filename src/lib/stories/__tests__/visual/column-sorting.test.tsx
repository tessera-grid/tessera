import { userEvent } from 'vitest/browser'
import { composeStories } from '@storybook/react-vite'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import * as stories from '../../DataGrid.stories'

// Every Column Sorting requirement is its own named test, prefixed with its spec
// ID (CS1–CS13 from the requirements table in docs/decisions/0012-column-sorting.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the canonical `ColumnSorting` story, sized to overflow vertically so
// the row-ordering requirements (CS12–CS13) have enough rendered rows to prove the
// order against. Synthetic input drives the mechanics; the two things it can't do —
// the CSS `:hover` reveal (CS5) and the Base UI tooltip (CS7) — use trusted browser
// input.

const composed = composeStories(stories)

// --- Selectors (part of the component contract) -------------------------------

/** Icon side per spec (`SortButton.tsx`: `<SortIcon width={16} height={16} />`). */
const SORT_ICON_SIZE = 16

/** Default lucide icon classes per direction (`ui/icons/IconsContext.tsx`). */
const ICON_UNSORTED = 'lucide-chevrons-up-down'
const ICON_ASC = 'lucide-chevron-up'
const ICON_DESC = 'lucide-chevron-down'

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
/** ColumnSorting plugin's sort toggle, rendered per sortable header. */
const SORT_BUTTON = '.column-sort__button'
/** A header cell of a real (non-action) data column. */
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`

// --- Rendering / DOM helpers --------------------------------------------------

type StoryArgs = Partial<Parameters<typeof composed.ColumnSorting>[0]>

/** Render the ColumnSorting story and wait until its header cells are on screen. */
async function renderColumnSorting(args: StoryArgs = {}) {
  const { container } = await render(<composed.ColumnSorting {...args} />)
  await expect
    .poll(() => container.querySelectorAll(HEAD_CELL).length)
    .toBeGreaterThan(3)
  return container
}

/**
 * Wait until `text` appears anywhere in the document (Base UI tooltips render
 * into a body portal after an open delay). A macrotask loop is used instead of
 * `expect.poll` because the tooltip's open timer needs real setTimeout ticks to
 * fire between checks.
 */
const waitForBodyText = async (text: string, timeout = 3000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (document.body.textContent?.includes(text)) return true
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

/** Rendered data-column header cells, in visual (left-to-right) order. */
const renderedDataCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(DATA_HEAD_CELL))
    // real columns carry aria-colindex; virtualization padding divs do not
    .filter(cell => cell.getAttribute('aria-colindex') !== null)
    .sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )

/** The sort toggle inside a header cell. */
const sortButtonOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(SORT_BUTTON)!

/** The rendered direction icon (`svg`) inside a sort button. */
const iconOf = (button: HTMLElement) => button.querySelector<SVGElement>('svg')!

/**
 * The `aria-sort` state of a header cell — the mock- and icon-agnostic sort
 * signal (`HeadCell` sets it from `column.getIsSorted()`): `none` /
 * `ascending` / `descending`, absent on a non-sortable column.
 */
const ariaSortOf = (cell: HTMLElement) => cell.getAttribute('aria-sort')

/**
 * The hover-hidden wrapper around a sort button. It carries `data-button-active`,
 * so we can find it structurally regardless of the (hashed) module class name;
 * it is the element `buttonVisibility.css` toggles opacity on.
 */
const hiddenWrapperOf = (button: HTMLElement) =>
  button.closest<HTMLElement>('[data-button-active]')!

/** Reveal a cell's hover-hidden controls with a trusted pointer, return its sort. */
const revealSort = async (cell: HTMLElement) => {
  await userEvent.hover(cell)
  const button = sortButtonOf(cell)
  await expect
    .poll(() => getComputedStyle(hiddenWrapperOf(button)).opacity)
    .toBe('1')
  return button
}

/** The leftmost rendered data column (always in the horizontal window). */
const firstDataCell = (container: HTMLElement) => renderedDataCells(container)[0]

/** The `aria-colindex` of a header cell as a selector-ready string. */
const colIndexOf = (cell: HTMLElement) => cell.getAttribute('aria-colindex')!

/**
 * Rendered body-cell text for one column (by colindex), in visual top-to-bottom
 * order. Rows are absolutely positioned by the virtualizer, so DOM order isn't
 * visual order — sort by bounding-box top.
 */
const columnValues = (container: HTMLElement, colIndex: string) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      `${BODY_CELL}[aria-colindex='${colIndex}']`,
    ),
  )
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    .map(cell => cell.textContent?.trim() ?? '')

/** Case-insensitive code-point compare — matches TanStack's `text` sorting fn. */
const cmp = (a: string, b: string) => {
  const al = a.toLowerCase()
  const bl = b.toLowerCase()
  return al === bl ? 0 : al > bl ? 1 : -1
}

const isNonDecreasing = (values: string[]) =>
  values.every((v, i) => i === 0 || cmp(values[i - 1], v) <= 0)

const isNonIncreasing = (values: string[]) =>
  values.every((v, i) => i === 0 || cmp(values[i - 1], v) >= 0)

// --- Setup guard --------------------------------------------------------------
// Not a requirement itself; it protects the ordering requirements (CS12–CS13)
// from silently passing when the grid renders too few rows to prove an order.

describe('Column Sorting — setup guard', () => {
  test('ColumnSorting story renders several rows (feeds CS12–CS13)', async () => {
    const container = await renderColumnSorting()
    const values = columnValues(container, colIndexOf(firstDataCell(container)))
    expect(values.length).toBeGreaterThan(3)
  })
})

// --- Requirements (CS1–CS13) --------------------------------------------------

describe('Column Sorting — requirements', () => {
  test('CS1: the plugin is inert without `enableColumnSorting`', async () => {
    const container = await renderColumnSorting({ enableColumnSorting: false })
    // Feature off → getCanSort() is false → no toggle rendered anywhere.
    expect(container.querySelector(SORT_BUTTON)).toBeNull()
  })

  test('CS2: each sortable data column gets a sort button in its header', async () => {
    const container = await renderColumnSorting()
    const dataCells = renderedDataCells(container)
    expect(dataCells.length).toBeGreaterThan(0)
    // Every rendered data column carries exactly one sort toggle.
    expect(
      container.querySelectorAll(`${DATA_HEAD_CELL} ${SORT_BUTTON}`).length,
    ).toBe(dataCells.length)
  })

  test('CS3: the sort icon is 16×16', async () => {
    const container = await renderColumnSorting()
    const svg = container.querySelector<SVGElement>(`${SORT_BUTTON} svg`)!
    const style = getComputedStyle(svg)
    expect(style.width).toBe(`${SORT_ICON_SIZE}px`)
    expect(style.height).toBe(`${SORT_ICON_SIZE}px`)
  })

  test('CS4: an unsorted sort button is hidden (opacity 0) until the header is hovered', async () => {
    const container = await renderColumnSorting()
    // An unsorted column's toggle: hidden wrapper, not yet active.
    const wrapper = hiddenWrapperOf(sortButtonOf(firstDataCell(container)))
    expect(wrapper.getAttribute('data-button-active')).toBe('false')
    expect(getComputedStyle(wrapper).opacity).toBe('0')
  })

  test('CS5: the sort button is revealed on header hover', async () => {
    const container = await renderColumnSorting()
    const cell = firstDataCell(container)
    const wrapper = hiddenWrapperOf(sortButtonOf(cell))

    // Trusted hover (real pointer) triggers the CSS `:hover` reveal on the cell.
    await userEvent.hover(cell)
    await expect.poll(() => getComputedStyle(wrapper).opacity).toBe('1')
  })

  test('CS6: a sorted column keeps its button visible without hover', async () => {
    const container = await renderColumnSorting()
    const cell = firstDataCell(container)

    // Sort the column, then move the pointer away to a different cell.
    const button = await revealSort(cell)
    await userEvent.click(button)
    await userEvent.hover(renderedDataCells(container)[2])

    // Active toggle stays fully visible even though nothing is hovered.
    const wrapper = hiddenWrapperOf(sortButtonOf(firstDataCell(container)))
    expect(wrapper.getAttribute('data-button-active')).toBe('true')
    await expect.poll(() => getComputedStyle(wrapper).opacity).toBe('1')
  })

  test('CS7: the tooltip describes the next action (descending → ascending → clear)', async () => {
    const container = await renderColumnSorting()
    const cell = firstDataCell(container)

    // Unsorted → next action is "Sort descending" (sortDescFirst).
    let button = await revealSort(cell)
    await userEvent.hover(button)
    expect(await waitForBodyText('Sort descending')).toBe(true)

    // After first click the column is desc → next action is "Sort ascending".
    await userEvent.click(button)
    await userEvent.hover(renderedDataCells(container)[2])
    button = sortButtonOf(firstDataCell(container))
    await userEvent.hover(button)
    expect(await waitForBodyText('Sort ascending')).toBe(true)

    // After second click it is asc → next action clears the sort.
    await userEvent.click(button)
    await userEvent.hover(renderedDataCells(container)[2])
    button = sortButtonOf(firstDataCell(container))
    await userEvent.hover(button)
    expect(await waitForBodyText('Clear sorting')).toBe(true)
  })

  test('CS8: the icon reflects the current direction', async () => {
    const container = await renderColumnSorting()
    const cell = firstDataCell(container)

    // Unsorted → the neutral sort icon.
    expect(iconOf(sortButtonOf(cell)).classList).toContain(ICON_UNSORTED)

    // First click → desc icon.
    const button = await revealSort(cell)
    await userEvent.click(button)
    await expect
      .poll(() =>
        iconOf(sortButtonOf(firstDataCell(container))).classList.contains(
          ICON_DESC,
        ),
      )
      .toBe(true)

    // Second click → asc icon.
    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect
      .poll(() =>
        iconOf(sortButtonOf(firstDataCell(container))).classList.contains(
          ICON_ASC,
        ),
      )
      .toBe(true)
  })

  test('CS9: clicking cycles descending → ascending → none (removal enabled)', async () => {
    const container = await renderColumnSorting()
    const button = await revealSort(firstDataCell(container))

    // Direction is read from `aria-sort` — the contract signal, not the icon.
    await userEvent.click(button)
    await expect
      .poll(() => ariaSortOf(firstDataCell(container)))
      .toBe('descending')

    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect
      .poll(() => ariaSortOf(firstDataCell(container)))
      .toBe('ascending')

    // 3rd click clears the sort back to 'none'.
    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect.poll(() => ariaSortOf(firstDataCell(container))).toBe('none')
  })

  test('CS10: with removal disabled the cycle never clears (descending → ascending → descending)', async () => {
    const container = await renderColumnSorting({ enableSortingRemoval: false })
    const button = await revealSort(firstDataCell(container))

    await userEvent.click(button)
    await expect
      .poll(() => ariaSortOf(firstDataCell(container)))
      .toBe('descending')
    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect
      .poll(() => ariaSortOf(firstDataCell(container)))
      .toBe('ascending')

    // Third click wraps back to descending instead of clearing to 'none'.
    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect
      .poll(() => ariaSortOf(firstDataCell(container)))
      .toBe('descending')
  })

  test('CS11: toggling calls the `onToggleColumnSort` hook with id and next direction', async () => {
    const onToggleColumnSort = vi.fn()
    const container = await renderColumnSorting({ onToggleColumnSort })

    // Read the clicked column's logical id from the DOM contract
    // (`data-column-id`) instead of hard-coding a mock column id.
    const cell = firstDataCell(container)
    const columnId = cell.getAttribute('data-column-id')!
    expect(columnId).toBeTruthy()
    const button = await revealSort(cell)

    // First click → that exact id + next direction desc (sortDescFirst).
    await userEvent.click(button)
    expect(onToggleColumnSort).toHaveBeenLastCalledWith(columnId, 'desc')

    // Second click on the same header → same id, next direction asc.
    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect
      .poll(() => onToggleColumnSort.mock.calls.at(-1)?.[1])
      .toBe('asc')
    expect(onToggleColumnSort.mock.calls.at(-1)![0]).toBe(columnId)
  })

  test('CS12: client sorting reorders rows (desc descending, asc ascending)', async () => {
    const container = await renderColumnSorting()
    const cell = firstDataCell(container)
    const colIndex = colIndexOf(cell)

    // First click → desc: rendered values are non-increasing.
    const button = await revealSort(cell)
    await userEvent.click(button)
    await expect
      .poll(() => isNonIncreasing(columnValues(container, colIndex)))
      .toBe(true)

    // Second click → asc: rendered values flip to non-decreasing.
    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect
      .poll(() => isNonDecreasing(columnValues(container, colIndex)))
      .toBe(true)
  })

  test('CS13: server sorting keeps row order but still toggles state and hook', async () => {
    const onToggleColumnSort = vi.fn()
    const container = await renderColumnSorting({
      serverColumnSorting: true,
      onToggleColumnSort,
    })
    const cell = firstDataCell(container)
    const colIndex = colIndexOf(cell)
    const before = columnValues(container, colIndex)

    const button = await revealSort(cell)
    await userEvent.click(button)

    // State flips (button active) and the hook fires…
    await expect
      .poll(() =>
        hiddenWrapperOf(sortButtonOf(firstDataCell(container))).getAttribute(
          'data-button-active',
        ),
      )
      .toBe('true')
    expect(onToggleColumnSort).toHaveBeenCalled()

    // …but the client row model is untouched — the server owns the order.
    expect(columnValues(container, colIndex)).toEqual(before)
  })

  test('CS14: a sortable header exposes aria-sort; a non-sortable one omits it', async () => {
    // Feature off → the column is not sortable → the attribute is absent
    // entirely (per ARIA, `aria-sort='none'` would imply a sortable column).
    const off = await renderColumnSorting({ enableColumnSorting: false })
    expect(firstDataCell(off).hasAttribute('aria-sort')).toBe(false)

    // Feature on → a sortable-but-unsorted column advertises `aria-sort='none'`,
    // then tracks the direction as it is toggled.
    const container = await renderColumnSorting()
    const cell = firstDataCell(container)
    expect(ariaSortOf(cell)).toBe('none')

    const button = await revealSort(cell)
    await userEvent.click(button)
    await expect
      .poll(() => ariaSortOf(firstDataCell(container)))
      .toBe('descending')
  })
})
