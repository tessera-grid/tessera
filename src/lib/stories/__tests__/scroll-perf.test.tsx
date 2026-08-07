import { page } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import { FRAME_BUDGET_60FPS, measureScrollWork, renderGrid } from './helpers'

// Требования производительности из docs/decisions/0004-core-on-tanstack-table.md
// (R19 — вертикаль, R20 — горизонталь): во время прокрутки реальная работа
// main-thread на кадр (script/style/layout — то есть стоимость отрисовки)
// удерживается в бюджете 60fps. Метрика — CDP-трейс реальных длительностей задач,
// а не rAF по стенным часам, поэтому не зависит от частоты обновления дисплея;
// проверяется p95 самых тяжёлых задач (< 16.7 мс). Случай подобран заведомо
// тяжёлым (30×500) как гарантия «в любых условиях»; механизмы, дающие эту
// гарантию, — виртуализация (ADR 0005) и fast-scroll (ADR 0008).

const waitForGrid = () =>
  expect.element(page.getByText('Country')).toBeInTheDocument()

describe('Производительность прокрутки на большом гриде (30 × 500)', () => {
  test('R19: вертикальная прокрутка удерживает 60fps (p95)', async () => {
    renderGrid({ columnCount: 30, dataCount: 500 })
    await waitForGrid()

    const { p95Ms, longestMs, tasksOverBudget } = await measureScrollWork('y')

    expect(
      p95Ms,
      `Y p95=${p95Ms.toFixed(1)}ms longest=${longestMs.toFixed(1)}ms over-budget=${tasksOverBudget}`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
  })

  test('R20: горизонтальная прокрутка удерживает 60fps (p95)', async () => {
    renderGrid({ columnCount: 30, dataCount: 500 })
    await waitForGrid()

    const { p95Ms, longestMs, tasksOverBudget } = await measureScrollWork('x')

    expect(
      p95Ms,
      `X p95=${p95Ms.toFixed(1)}ms longest=${longestMs.toFixed(1)}ms over-budget=${tasksOverBudget}`,
    ).toBeLessThanOrEqual(FRAME_BUDGET_60FPS)
  })
})
