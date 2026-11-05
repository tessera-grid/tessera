import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { composed } from '../stories'
import { tableLabels } from '../labels'
import { columnSortingLabels } from '../../../plugins/columnSorting/labels'

// Every Column Sorting requirement is its own named test, prefixed with its spec
// ID (CS1–CS13 from the requirements table in docs/decisions/0012-column-sorting.md).
// So `npm test` reports — and fails — each requirement individually, and the test
// name points straight at the requirement it guards (see the naming rule in
// docs/decisions/0009-test-coverage-visual-and-performance.md).
// Tests drive the canonical `ColumnSortingPlayground` story, sized to overflow vertically so
// the row-ordering requirements (CS12–CS13) have enough rendered rows to prove the
// order against. Synthetic input drives the mechanics; the two things it can't do —
// the CSS `:hover` reveal (CS5) and the Base UI tooltip (CS7) — use trusted browser
// input.

// --- Selectors (part of the component contract) -------------------------------

/** Icon side per spec (`sortHeaderAction.tsx`: `<Icon width={16} height={16} />`). */
const SORT_ICON_SIZE = 16

/** Default lucide icon classes per direction (`ui/icons/IconsContext.tsx`). */
// Ключи иконок из `icons` (ADR 0018): какая иконка показана, а не чья она.
const ICON_UNSORTED = 'sort'
const ICON_ASC = 'sortAsc'
const ICON_DESC = 'sortDesc'

const HEAD_CELL = '.data-grid__head-cell'
const BODY_CELL = '.data-grid__body-cell'
/** ColumnSorting plugin's sort toggle, rendered per sortable header. */
const SORT_BUTTON = '.column-sort__button'
/** Multi-sort priority badge, rendered only while 2+ columns are sorted. */
const PRIORITY_BADGE = '[data-active-indicator][data-count]'
/** A header cell of a real (non-action) data column. */
const DATA_HEAD_CELL = `${HEAD_CELL}[data-actions-column-cell='false']`

// --- Rendering / DOM helpers --------------------------------------------------

type StoryArgs = Partial<Parameters<typeof composed.ColumnSortingPlayground>[0]>

/** Render the ColumnSorting story and wait until its header cells are on screen. */
async function renderColumnSorting(args: StoryArgs = {}) {
  const { container } = await render(
    <composed.ColumnSortingPlayground {...args} />,
  )
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
const firstDataCell = (container: HTMLElement) =>
  renderedDataCells(container)[0]

/** The nth rendered data column (0-based), re-queried against the live DOM. */
const dataCell = (container: HTMLElement, index: number) =>
  renderedDataCells(container)[index]

/** The priority badge inside a header cell, or null when it isn't rendered. */
const priorityOf = (cell: HTMLElement) =>
  cell.querySelector<HTMLElement>(PRIORITY_BADGE)

/** Count of data columns currently carrying a direction (aria-sort ≠ none). */
const sortedColumnCount = (container: HTMLElement) =>
  renderedDataCells(container).filter(cell => ariaSortOf(cell) !== 'none')
    .length

/**
 * Click while Shift is held — the default multi-sort gesture (`isMultiSortEvent`
 * = `e.shiftKey`). Playwright tracks the held key, so the click event carries
 * `shiftKey`. Press and release around the click so no other input is affected.
 */
const shiftClick = async (element: HTMLElement) => {
  await userEvent.keyboard('{Shift>}')
  await userEvent.click(element)
  await userEvent.keyboard('{/Shift}')
}

/** Reveal a column's toggle (hover), then Shift+click it to add it to the sort. */
const shiftSort = async (cell: HTMLElement) => {
  const button = await revealSort(cell)
  await shiftClick(button)
}

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
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
    )
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
    expect(
      await waitForBodyText(columnSortingLabels(tableLabels).sortDescending),
    ).toBe(true)

    // After first click the column is desc → next action is "Sort ascending".
    await userEvent.click(button)
    await userEvent.hover(renderedDataCells(container)[2])
    button = sortButtonOf(firstDataCell(container))
    await userEvent.hover(button)
    expect(
      await waitForBodyText(columnSortingLabels(tableLabels).sortAscending),
    ).toBe(true)

    // After second click it is asc → next action clears the sort.
    await userEvent.click(button)
    await userEvent.hover(renderedDataCells(container)[2])
    button = sortButtonOf(firstDataCell(container))
    await userEvent.hover(button)
    expect(
      await waitForBodyText(columnSortingLabels(tableLabels).clearSort),
    ).toBe(true)
  })

  test('CS8: the icon reflects the current direction', async () => {
    const container = await renderColumnSorting()
    const cell = firstDataCell(container)

    // Unsorted → the neutral sort icon.
    expect(iconOf(sortButtonOf(cell)).getAttribute('data-icon')).toBe(
      ICON_UNSORTED,
    )

    // First click → desc icon.
    const button = await revealSort(cell)
    await userEvent.click(button)
    await expect
      .poll(
        () =>
          iconOf(sortButtonOf(firstDataCell(container))).getAttribute(
            'data-icon',
          ) === ICON_DESC,
      )
      .toBe(true)

    // Second click → asc icon.
    await userEvent.click(sortButtonOf(firstDataCell(container)))
    await expect
      .poll(
        () =>
          iconOf(sortButtonOf(firstDataCell(container))).getAttribute(
            'data-icon',
          ) === ICON_ASC,
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
    const container = await renderColumnSorting({ columnSortingRemoval: false })
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
    expect(onToggleColumnSort).toHaveBeenLastCalledWith(columnId, 'desc', {
      signal: expect.any(AbortSignal),
    })

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
      dataMode: { sorting: 'server' },
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

  test('CS15: enabling the plugin after mount reveals the sort button (presence-based slots are reactive)', async () => {
    // Guards the presence-based slot contract: slots are declared on the registry
    // entry and folded reactively from the active plugin set, so toggling a plugin
    // on AFTER mount must register its header slot and reveal the button.
    const { container, rerender } = await render(
      <composed.ColumnSortingPlayground enableColumnSorting={false} />,
    )
    await expect
      .poll(() => container.querySelectorAll(HEAD_CELL).length)
      .toBeGreaterThan(3)
    expect(container.querySelector(SORT_BUTTON)).toBeNull()

    // Toggle the plugin on — the sort button must appear without a remount.
    await rerender(<composed.ColumnSortingPlayground enableColumnSorting />)
    await expect
      .poll(() => container.querySelectorAll(SORT_BUTTON).length)
      .toBeGreaterThan(0)
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

// --- Multi-sort requirements (CS16–CS23) --------------------------------------
// Multi-sort is built on TanStack's native model (`enableMultiSort`,
// `isMultiSortEvent`, `maxMultiSortColCount`, `column.getSortIndex()`); the plugin
// adds the config surface, the header priority badge and the a11y label. The
// default gesture is Shift+click, so a plain click still replaces the sort — which
// is why the single-column requirements above are unaffected. See the CS16–CS23
// table in docs/decisions/0012-column-sorting.md.

describe('Column Sorting — multi-sort requirements', () => {
  test('CS16: Shift+click adds a second column to the sort', async () => {
    const container = await renderColumnSorting()

    // Plain click on the first column establishes a single-column sort…
    await userEvent.click(await revealSort(dataCell(container, 0)))
    await expect
      .poll(() => ariaSortOf(dataCell(container, 0)))
      .toBe('descending')

    // …then Shift+click on the second column ADDS it instead of replacing.
    await shiftSort(dataCell(container, 1))
    await expect
      .poll(() => ariaSortOf(dataCell(container, 1)))
      .toBe('descending')
    // The first column keeps its direction — both columns now sort the rows.
    expect(ariaSortOf(dataCell(container, 0))).toBe('descending')
    expect(sortedColumnCount(container)).toBe(2)
  })

  test('CS17: the priority badge appears only when 2+ columns are sorted', async () => {
    const container = await renderColumnSorting()

    // A single sorted column carries no priority badge (UI stays as single-sort).
    await userEvent.click(await revealSort(dataCell(container, 0)))
    await expect
      .poll(() => ariaSortOf(dataCell(container, 0)))
      .toBe('descending')
    expect(priorityOf(dataCell(container, 0))).toBeNull()

    // Adding a second sorted column reveals the badge on BOTH.
    await shiftSort(dataCell(container, 1))
    await expect.poll(() => priorityOf(dataCell(container, 0))).not.toBeNull()
    expect(priorityOf(dataCell(container, 1))).not.toBeNull()
  })

  test('CS18: priority badges number columns in sort order (1-based)', async () => {
    const container = await renderColumnSorting()

    await userEvent.click(await revealSort(dataCell(container, 0)))
    await shiftSort(dataCell(container, 1))

    // First-added column is priority 1, second-added is priority 2.
    await expect
      .poll(() =>
        priorityOf(dataCell(container, 0))?.getAttribute('data-count'),
      )
      .toBe('1')
    expect(priorityOf(dataCell(container, 1))?.getAttribute('data-count')).toBe(
      '2',
    )
  })

  test('CS19: `max` caps the number of columns in the multi-sort', async () => {
    const container = await renderColumnSorting({
      columnSortingMultiSort: { max: 2 },
    })

    // Sort three columns: plain first, then Shift+click two more.
    await userEvent.click(await revealSort(dataCell(container, 0)))
    await shiftSort(dataCell(container, 1))
    await shiftSort(dataCell(container, 2))

    // The cap holds — never more than two columns sort at once (the oldest is
    // evicted), and it doesn't collapse back to a single column.
    await expect.poll(() => sortedColumnCount(container)).toBe(2)
  })

  test('CS21: with multi-sort off, Shift+click replaces instead of adding', async () => {
    const container = await renderColumnSorting({
      columnSortingMultiSort: false,
    })

    await userEvent.click(await revealSort(dataCell(container, 0)))
    await expect
      .poll(() => ariaSortOf(dataCell(container, 0)))
      .toBe('descending')

    // Shift+click on another column REPLACES the sort (single-column model), so
    // exactly one column is sorted and no priority badge is shown.
    await shiftSort(dataCell(container, 1))
    await expect
      .poll(() => ariaSortOf(dataCell(container, 1)))
      .toBe('descending')
    expect(ariaSortOf(dataCell(container, 0))).toBe('none')
    expect(sortedColumnCount(container)).toBe(1)
    expect(priorityOf(dataCell(container, 1))).toBeNull()
  })

  test('CS22: the sort button aria-label conveys the priority for screen readers', async () => {
    const container = await renderColumnSorting()

    await userEvent.click(await revealSort(dataCell(container, 0)))
    await shiftSort(dataCell(container, 1))
    await expect.poll(() => priorityOf(dataCell(container, 0))).not.toBeNull()

    // aria-label overrides the button's content, so the numeric badge is spoken
    // via the label — the first column announces "priority 1 of 2".
    const label = sortButtonOf(dataCell(container, 0)).getAttribute(
      'aria-label',
    )
    expect(label).toContain(columnSortingLabels(tableLabels).sortPriority(1, 2))
  })

  test('CS23: server multi-sort keeps row order but tracks every sorted column', async () => {
    const container = await renderColumnSorting({
      dataMode: { sorting: 'server' },
    })
    const colIndex = colIndexOf(dataCell(container, 0))
    const before = columnValues(container, colIndex)

    await userEvent.click(await revealSort(dataCell(container, 0)))
    await shiftSort(dataCell(container, 1))

    // Both columns register in the sort state (indicators + badges)…
    await expect.poll(() => sortedColumnCount(container)).toBe(2)
    expect(priorityOf(dataCell(container, 0))).not.toBeNull()

    // …but the client row model is untouched — the server owns the order.
    expect(columnValues(container, colIndex)).toEqual(before)
  })
})

describe('Column Sorting — tree rows', () => {
  const row = (id: string, country: string, subRows?: unknown[]) => ({
    id,
    country,
    firstName: id,
    lastName: id,
    age: 30,
    visits: 1,
    gender: 'male',
    total: 500,
    ...(subRows && { subRows }),
  })

  test('CS24: after client sorting, a row whose children were reordered is found by id — its cell selects', async () => {
    // Сортировка по убыванию переставит детей `parent` (A, B → B, A): TanStack
    // подменит строку копией.
    const container = await renderColumnSorting({
      enableCellSelection: true,
      dataOverride: [
        row('parent', 'M', [row('child-a', 'A'), row('child-b', 'B')]),
        row('other', 'Z'),
      ],
    })
    const head = container.querySelector<HTMLElement>(
      `${HEAD_CELL}[data-column-id="country"]`,
    )!
    await userEvent.click(await revealSort(head))
    await expect.poll(() => ariaSortOf(head)).toBe('descending')

    const cell = () =>
      container.querySelector<HTMLElement>(
        `[data-row-id="parent"] ${BODY_CELL}[data-column-id="country"]`,
      )!
    await userEvent.click(cell())
    await expect
      .poll(() => cell().getAttribute('data-cell-selected'))
      .toBe('true')
  })
})
