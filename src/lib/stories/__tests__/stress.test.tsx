import { page } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import {
  FRAME_BUDGET_60FPS,
  bodyRows,
  headCells,
  measureScrollWork,
  renderGrid,
  renderedColumnIndexes,
  renderedRowIndexes,
  scrollToEnd,
} from './helpers'

// Stress test: an extreme 1000 x 1000 grid, with no plugins and with every
// plugin enabled. Virtualization keeps the per-frame cost bounded (only the
// visible window is rendered), so the full set stays reachable regardless of
// total size.
//
// Scroll smoothness is measured as REAL main-thread work per frame via CDP
// tracing (actual task durations, not rAF wall-clock — independent of the
// display's refresh rate). Budgets differ by configuration:
//   - no plugins  → strict 60fps (16.7ms): pure virtualization must hold it.
//   - all plugins → documented ceilings, NOT 60fps. With every plugin active on
//     a 1000x1000 grid the per-frame mount cost genuinely exceeds one frame on
//     a large share of frames (see ADR / perf notes). These bounds pin the
//     current measured ceiling and guard against regressions rather than
//     asserting smoothness that the configuration cannot deliver. Horizontal
//     scroll is markedly heavier than vertical (more service work per mounted
//     column) and has its own, looser bound.

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

interface ScrollBudget {
  /** p95 heavy-task budget for vertical scroll, ms. */
  y: number
  /** p95 heavy-task budget for horizontal scroll, ms. */
  x: number
}

const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

describe.each([
  {
    name: 'no plugins',
    args: {} as Record<string, boolean>,
    // Pure virtualization holds 60fps on both axes.
    budget: { y: FRAME_BUDGET_60FPS, x: FRAME_BUDGET_60FPS } as ScrollBudget,
  },
  {
    name: 'all plugins',
    args: { ...ALL_PLUGINS },
    // Measured ceiling (~19ms Y / ~64ms X p95) + headroom. Not a 60fps claim.
    budget: { y: 30, x: 90 } as ScrollBudget,
  },
])('stress 1000x1000 — $name', ({ args, budget }) => {
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
    'per-frame work stays within budget on both axes',
    async () => {
      renderGrid({ columnCount: COLUMN_COUNT, dataCount: DATA_COUNT, ...args })
      await waitForGrid()

      const y = await measureScrollWork('y')
      expect(
        y.p95Ms,
        `Y p95=${y.p95Ms.toFixed(1)}ms longest=${y.longestMs.toFixed(1)}ms over-budget=${y.tasksOverBudget}/${y.taskCount}`,
      ).toBeLessThanOrEqual(budget.y)

      const x = await measureScrollWork('x')
      expect(
        x.p95Ms,
        `X p95=${x.p95Ms.toFixed(1)}ms longest=${x.longestMs.toFixed(1)}ms over-budget=${x.tasksOverBudget}/${x.taskCount}`,
      ).toBeLessThanOrEqual(budget.x)
    },
    TIMEOUT,
  )
})
