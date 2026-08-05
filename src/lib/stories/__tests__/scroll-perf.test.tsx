import { page } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { FRAME_BUDGET_60FPS, measureScrollFps, renderGrid } from './helpers'

// Requirement #1: the table scrolls on X and Y without frame drops.
// Metric: the 95th-percentile frame duration during a continuous scroll must
// stay within the 60fps budget (< 16.7ms).

const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

describe('scroll performance on a large plain grid (30 x 500)', () => {
  test('vertical scroll holds 60fps (p95)', async () => {
    renderGrid({ columnCount: 30, dataCount: 500 })
    await waitForGrid()

    const { p95, worst, avg } = await measureScrollFps('y')

    expect(
      p95,
      `Y-scroll p95=${p95.toFixed(1)}ms worst=${worst.toFixed(1)}ms avg=${avg.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
  })

  test('horizontal scroll holds 60fps (p95)', async () => {
    renderGrid({ columnCount: 30, dataCount: 500 })
    await waitForGrid()

    const { p95, worst, avg } = await measureScrollFps('x')

    expect(
      p95,
      `X-scroll p95=${p95.toFixed(1)}ms worst=${worst.toFixed(1)}ms avg=${avg.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
  })
})
