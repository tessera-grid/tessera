import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'
import { composeStories } from '@storybook/react-vite'

import * as pagination from '../../DataGrid.Panels.Pagination.stories'
import * as toolbar from '../../DataGrid.Panels.Toolbar.stories'

// Контролы панелей на целых пикселях (ADR 0035, TB21; ADR 0038, SB16).

const { ToolbarPlayground } = composeStories(toolbar)
const { PaginationPlayground } = composeStories(pagination)

/** Отступ каждого контрола от верха и низа панели. */
const insets = (bar: Element) => {
  const box = bar.getBoundingClientRect()
  return [...bar.querySelectorAll('button, input')].map(el => {
    const r = el.getBoundingClientRect()
    return [r.top - box.top, box.bottom - r.bottom]
  })
}

/** Отступы — целые и равные сверху и снизу. */
const offGrid = (bar: Element) =>
  insets(bar).filter(
    ([top, bottom]) => !Number.isInteger(top) || top !== bottom,
  )

describe('Контролы панелей на целых пикселях', () => {
  test('TB21: контролы тулбара — на целых пикселях, на равном расстоянии от верха и низа: разделитель уравновешен полем', async () => {
    const view = await render(<ToolbarPlayground />)
    await expect
      .poll(() => document.querySelector('[role="toolbar"] button'))
      .toBeTruthy()
    const bar = document.querySelector('[role="toolbar"]')!
    expect(insets(bar).length).toBeGreaterThan(1)
    expect(offGrid(bar)).toEqual([])
    await view.unmount()
  })

  test('SB16: контролы нижней панели — на целых пикселях, на равном расстоянии от верха и низа: разделитель уравновешен полем', async () => {
    const view = await render(<PaginationPlayground />)
    await expect
      .poll(() => document.querySelector('[data-status-bar-layout] button'))
      .toBeTruthy()
    const bar = document.querySelector('[data-status-bar-layout]')!
    expect(insets(bar).length).toBeGreaterThan(1)
    expect(offGrid(bar)).toEqual([])
    await view.unmount()
  })
})
