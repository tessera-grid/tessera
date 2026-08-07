import { page } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import {
  FRAME_BUDGET_60FPS,
  bodyRows,
  measureScrollWork,
  renderGrid,
  renderedRowIndexes,
  scrollToEnd,
} from './helpers'

// Requirement #3: run the render (#2) and scroll-performance (#1) checks for
// each plugin on its own, and for all of them enabled together.

type PluginArgs = Record<string, boolean>

const INDIVIDUAL: Array<{ name: string; args: PluginArgs }> = [
  { name: 'Column Sorting', args: { enableColumnSorting: true } },
  { name: 'Column Resizing', args: { enableColumnResizing: true } },
  { name: 'Column Pinning', args: { enableColumnPinning: true } },
  { name: 'Column Dragging', args: { enableColumnDragging: true } },
  { name: 'Row Selection', args: { enableRowSelection: true } },
  { name: 'Row Dragging', args: { enableRowDragging: true } },
  { name: 'Row Actions', args: { enableRowActions: true } },
  { name: 'Footer', args: { enableFooter: true } },
]

const ALL_TOGETHER: PluginArgs = INDIVIDUAL.reduce(
  (acc, { args }) => ({ ...acc, ...args }),
  {},
)

const CASES = [
  ...INDIVIDUAL,
  { name: 'All plugins together', args: ALL_TOGETHER },
]

const COLUMN_COUNT = 20
const DATA_COUNT = 300

const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

describe.each(CASES)('$name', ({ args }) => {
  test('renders and honors the full data set (#2)', async () => {
    renderGrid({ columnCount: COLUMN_COUNT, dataCount: DATA_COUNT, ...args })
    await waitForGrid()

    // virtualized: a subset renders...
    const rendered = bodyRows().length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(DATA_COUNT)

    // ...but every row is reachable — the last index shows after scrolling down.
    await scrollToEnd('y')
    expect(Math.max(...renderedRowIndexes())).toBe(DATA_COUNT - 1)
  })

  test('scrolls at 60fps on both axes (#1)', async () => {
    renderGrid({ columnCount: COLUMN_COUNT, dataCount: DATA_COUNT, ...args })
    await waitForGrid()

    const y = await measureScrollWork('y')
    expect(
      y.p95Ms,
      `Y-scroll p95=${y.p95Ms.toFixed(1)}ms longest=${y.longestMs.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)

    const x = await measureScrollWork('x')
    expect(
      x.p95Ms,
      `X-scroll p95=${x.p95Ms.toFixed(1)}ms longest=${x.longestMs.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
  })
})
