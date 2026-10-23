import { describe, expect, test } from 'vitest'

import { DATA_GRID_THEME_CLASS } from '../../../core/themeVariables'
import { bodyRows, getScroller, renderGrid } from '../helpers'

// Высота таблицы (ADR 0131). GH1–GH4 доказывают `play` историй `Core/Sizing`.

const MAX_HEIGHT = 400
const ROWS = 300

const rect = (element: Element) => element.getBoundingClientRect()
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)

describe('Высота таблицы', () => {
  test('GH5: с maxHeight числом в контейнере без высоты тулбар и нижняя панель — внутри предела, строки смонтированы только в окне', async () => {
    renderGrid({
      containerHeight: '',
      height: '',
      maxHeight: MAX_HEIGHT,
      dataCount: ROWS,
      enableToolbar: true,
      enableStatusBar: true,
    })
    await expect.poll(() => bodyRows().length).toBeGreaterThan(0)
    const scroller = getScroller()
    const root = scroller.closest(`.${DATA_GRID_THEME_CLASS}`)!
    // Модуль тулбара — ленивый (ADR 0061).
    const toolbarOf = () =>
      root.querySelector('[data-testid="data-grid-toolbar"]')
    await expect.poll(toolbarOf).not.toBeNull()
    const toolbar = toolbarOf()!
    const statusBar = root.querySelector(
      '[data-testid="data-grid-status-bar"]',
    )!

    near(rect(root).height, MAX_HEIGHT)
    const border = parseFloat(getComputedStyle(root).borderBottomWidth)
    near(rect(statusBar).bottom, rect(root).bottom - border)
    near(rect(scroller).top, rect(toolbar).bottom)
    near(rect(scroller).bottom, rect(statusBar).top)
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    expect(bodyRows().length).toBeLessThan(ROWS / 4)
  })
})
