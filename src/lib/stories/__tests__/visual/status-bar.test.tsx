import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { Stories, getScroller } from '../helpers'
import { composed, selectedCountArgs } from '../stories'
import { tableLabels } from '../labels'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'

// Нижняя панель грида (ADR 0038, SB1–SB4, SB6, SB15). Каждый тест — одно требование,
// назван по его ID. Состояние читается из DOM-контракта (data-*) и вычисленных
// стилей, а не из хешированных классов CSS-модулей. SB5 — модульный
// (`src/lib/__tests__/statusBar.test.ts`).

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 12,
  dataCount: 60,
}

const statusBar = () =>
  document.querySelector<HTMLElement>('[data-testid="data-grid-status-bar"]')
const side = (align: 'start' | 'end') =>
  statusBar()!.querySelector<HTMLElement>(`[data-align="${align}"]`)!
const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
const frame = () => getScroller().parentElement!
const rect = (el: Element) => el.getBoundingClientRect()
const read = (el: Element, prop: string) =>
  getComputedStyle(el).getPropertyValue(prop).trim()

/** Значение токена, разрешённое внутри рамки грида (там объявлена тема). */
const resolveToken = (token: string, prop = 'background-color') => {
  const probe = document.createElement('div')
  probe.style.setProperty(prop, `var(${token})`)
  frame().appendChild(probe)
  const value = getComputedStyle(probe).getPropertyValue(prop)
  probe.remove()
  return value
}

const renderStatusBar = (extra: { enableFooter?: boolean } = {}) =>
  render(<Stories.StatusBarPlayground {...GRID} {...extra} />)

describe('Status bar', () => {
  test('SB1: with a statusBarSlot the panel renders below the table; without slots — none', async () => {
    const plain = await render(<Stories.DataGridPlayground {...GRID} />)
    expect(statusBar()).toBeNull()
    await plain.unmount()

    await renderStatusBar()
    const bar = statusBar()!
    expect(rect(bar).top).toBeGreaterThanOrEqual(
      rect(getScroller()).bottom - 0.5,
    )
    expect(rect(bar).bottom).toBeCloseTo(
      rect(frame()).bottom - parseFloat(read(frame(), 'border-bottom-width')),
      0,
    )
  })

  test('SB2: the panel is outside the scroll container — scrolling on both axes does not move it', async () => {
    await renderStatusBar()
    const before = rect(statusBar()!)
    const scroller = getScroller()
    scroller.scrollTo({ top: 400, left: 300 })
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0)
    expect(scroller.scrollLeft).toBeGreaterThan(0)
    const after = rect(statusBar()!)
    expect([after.top, after.left, after.width]).toEqual([
      before.top,
      before.left,
      before.width,
    ])
    expect(scroller.contains(statusBar())).toBe(false)
  })

  test('SB3: one line separates the panel from the table; under the column footer it is not doubled', async () => {
    await renderStatusBar({ enableFooter: true })
    const bar = statusBar()!
    expect(read(bar, 'border-top-width')).toBe('1px')
    expect(read(bar, 'border-top-color')).toBe(
      resolveToken('--tsr-comp-status-bar-divider-color'),
    )
    const footer = document.querySelector<HTMLElement>('.data-grid__footer')!
    expect(read(footer, 'border-bottom-width')).toBe('0px')
    // Между футером и панелью — только горизонтальная полоса прокрутки, если она видима
    // (Windows, WebKit); без полосы футер стоит вплотную.
    const scroller = getScroller()
    const scrollbar =
      scroller.offsetHeight -
      scroller.clientHeight -
      parseFloat(read(scroller, 'border-top-width')) -
      parseFloat(read(scroller, 'border-bottom-width'))
    expect(rect(footer).bottom + scrollbar).toBeCloseTo(rect(bar).top, 0)
  })

  test("SB4: align 'start' slots are pushed left, 'end' — right; within a side they follow order", async () => {
    await renderStatusBar()
    const bar = rect(statusBar()!)
    const padding = parseFloat(read(statusBar()!, 'padding-left'))
    expect(rect(byTestId('status-bar-demo-rows')).left).toBeCloseTo(
      bar.left + padding,
      0,
    )
    expect(rect(byTestId('status-bar-demo-last')).right).toBeCloseTo(
      bar.right - padding,
      0,
    )
    expect(
      [...side('end').querySelectorAll('[data-testid]')].map(
        el => (el as HTMLElement).dataset.testid,
      ),
    ).toEqual(['status-bar-demo-first', 'status-bar-demo-last'])
  })

  test('SB6: height, paddings and background come from --tsr-comp-status-bar-* tokens', async () => {
    await renderStatusBar()
    const bar = statusBar()!
    expect(read(bar, 'height')).toBe(
      resolveToken('--tsr-comp-status-bar-height', 'height'),
    )
    expect(read(bar, 'padding-left')).toBe(
      resolveToken('--tsr-comp-status-bar-padding-x', 'padding-left'),
    )
    expect(read(bar, 'background-color')).toBe(
      resolveToken('--tsr-comp-status-bar-bg'),
    )

    bar.style.setProperty('--tsr-comp-status-bar-height', '60px')
    expect(read(bar, 'height')).toBe('60px')
    bar.style.removeProperty('--tsr-comp-status-bar-height')
  })

  test('SB15: the selected count and the pagination share one text size — --tsr-comp-status-bar-font-size, the cell size by default', async () => {
    const { container } = await render(
      <composed.StatusBarPlayground {...selectedCountArgs} {...GRID} />,
    )
    const checkbox = () =>
      container.querySelector<HTMLElement>(
        '[data-row-id] input[type="checkbox"], [data-row-id] [role="checkbox"]',
      )
    await expect.poll(checkbox).not.toBeNull()
    await userEvent.click(checkbox()!)
    const count = () =>
      statusBar()?.querySelector<HTMLElement>('[data-status-count]')
    await expect
      .poll(() => count()?.textContent)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(1))
    const range = byTestId('pagination-range')
    const size = resolveToken('--tsr-comp-status-bar-font-size', 'font-size')
    expect(size).toBe(resolveToken('--tsr-comp-cell-font-size', 'font-size'))
    expect(read(count()!, 'font-size')).toBe(size)
    expect(read(range, 'font-size')).toBe(size)

    const bar = statusBar()!
    bar.style.setProperty('--tsr-comp-status-bar-font-size', '15px')
    expect(read(count()!, 'font-size')).toBe('15px')
    expect(read(range, 'font-size')).toBe('15px')
    bar.style.removeProperty('--tsr-comp-status-bar-font-size')
  })
})
