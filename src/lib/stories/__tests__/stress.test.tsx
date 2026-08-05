import { page } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import {
  FRAME_BUDGET_60FPS,
  bodyRows,
  headCells,
  measureScrollFps,
  renderGrid,
  renderedColumnIndexes,
  renderedRowIndexes,
  scrollToEnd,
} from './helpers'

// Stress test: an extreme 1000 x 1000 grid, with no plugins and with every
// plugin enabled. Virtualization should keep the per-frame cost bounded (only
// the visible window is rendered), so scrolling must still hold 60fps and the
// full set must remain reachable — regardless of the total size.

const COLUMN_COUNT = 1000
const DATA_COUNT = 1000

const ALL_PLUGINS = {
  enableColumnSorting: true,
  enableColumnResizing: true,
  enableColumnPinning: true,
  enableColumnDragging: true,
  enableRowSelection: true,
  enableRowDragging: true,
  enableRowActions: true,
  enableFooter: true,
} as const

const TIMEOUT = 60_000

const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

describe.each([
  { name: 'no plugins', args: {} as Record<string, boolean> },
  { name: 'all plugins', args: { ...ALL_PLUGINS } },
])('stress 1000x1000 — $name', ({ args }) => {
  test(
    'virtualizes and keeps the full set reachable',
    async () => {
      renderGrid({ columnCount: COLUMN_COUNT, dataCount: DATA_COUNT, ...args })
      await waitForGrid()

      // Only a small window is rendered despite the huge totals.
      expect(bodyRows().length).toBeGreaterThan(0)
      expect(bodyRows().length).toBeLessThan(DATA_COUNT)
      expect(headCells().length).toBeLessThan(COLUMN_COUNT)

      // The far edges are reachable.
      await scrollToEnd('y', 4000)
      expect(Math.max(...renderedRowIndexes())).toBe(DATA_COUNT - 1)

      // Plugins may add service columns (selection / drag / actions), so assert
      // that at least every data column is reachable rather than an exact index.
      await scrollToEnd('x', 6000)
      expect(Math.max(...renderedColumnIndexes())).toBeGreaterThanOrEqual(
        COLUMN_COUNT - 1,
      )
    },
    TIMEOUT,
  )

  test(
    'scrolls at 60fps on both axes',
    async () => {
      renderGrid({ columnCount: COLUMN_COUNT, dataCount: DATA_COUNT, ...args })
      await waitForGrid()

      const y = await measureScrollFps('y')
      expect(
        y.p95,
        `Y-scroll p95=${y.p95.toFixed(1)}ms worst=${y.worst.toFixed(1)}ms avg=${y.avg.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)

      const x = await measureScrollFps('x')
      expect(
        x.p95,
        `X-scroll p95=${x.p95.toFixed(1)}ms worst=${x.worst.toFixed(1)}ms avg=${x.avg.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
    },
    TIMEOUT,
  )
})
