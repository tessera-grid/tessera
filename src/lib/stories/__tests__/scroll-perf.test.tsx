import { page } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { FRAME_BUDGET_60FPS, measureScrollWork, renderGrid } from './helpers'

// Requirement #1: the table scrolls on X and Y without frame drops.
// Metric: real main-thread work per frame, measured via CDP tracing (actual
// task durations, not rAF wall-clock — so it is independent of the display's
// refresh rate). The 95th-percentile heavy-task duration must stay within the
// 60fps budget (< 16.7ms).

const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

describe('scroll performance on a large plain grid (30 x 500)', () => {
  test('vertical scroll holds 60fps (p95)', async () => {
    renderGrid({ columnCount: 30, dataCount: 500 })
    await waitForGrid()

    const { p95Ms, longestMs, tasksOverBudget } = await measureScrollWork('y')

    expect(
      p95Ms,
      `Y p95=${p95Ms.toFixed(1)}ms longest=${longestMs.toFixed(1)}ms over-budget=${tasksOverBudget}`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
  })

  test('horizontal scroll holds 60fps (p95)', async () => {
    renderGrid({ columnCount: 30, dataCount: 500 })
    await waitForGrid()

    const { p95Ms, longestMs, tasksOverBudget } = await measureScrollWork('x')

    expect(
      p95Ms,
      `X p95=${p95Ms.toFixed(1)}ms longest=${longestMs.toFixed(1)}ms over-budget=${tasksOverBudget}`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
  })
})
