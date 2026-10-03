import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { bodyRows, humanClick } from '../helpers'
import { composed } from '../stories'

// Дымовой тест демо-истории «Panels — status bar off (own pager)» (ADR 0046, PB12;
// по образцу ADR 0042): нижней панели нет, свой пейджер листает страницы.

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const firstRowName = () =>
  bodyRows()[0]?.querySelector('[data-column-id="name"]')?.textContent?.trim()

describe('Демо-история Panels', () => {
  test('PB12: «Panels — status bar off (own pager)» — нижней панели нет, кнопки своего пейджера листают страницы', async () => {
    await render(<composed.PanelsOwnPager />)
    await expect.poll(() => bodyRows().length).toBe(10)
    expect(byTestId('data-grid-status-bar')).toBeNull()
    expect(byTestId('own-pager-label')!.textContent).toBe('Page 1 of 10')
    expect(firstRowName()).toBe('Alice 0')

    await humanClick(byTestId('own-pager-next')!)
    await expect.poll(firstRowName).toBe('Dave 10')
    expect(byTestId('own-pager-label')!.textContent).toBe('Page 2 of 10')

    await humanClick(byTestId('own-pager-prev')!)
    await expect.poll(firstRowName).toBe('Alice 0')
  })
})
