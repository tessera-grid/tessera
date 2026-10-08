import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { bodyRows, humanClick } from '../helpers'
import { composed } from '../stories'

// Дымовые тесты демо-историй Panels: «Status bar — Off (own pager)» (ADR 0046, PB12;
// по образцу ADR 0042) и «Pagination — Server» (ADR 0042, DS6).

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const orderedRows = () =>
  bodyRows().sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
const nameOf = (row: HTMLElement) =>
  row.querySelector('[data-column-id="name"]')?.textContent?.trim()
const firstRowName = () => {
  const [first] = orderedRows()
  return first && nameOf(first)
}
const log = () => byTestId('callback-log')!.innerText

describe('Демо-истории Panels', () => {
  test('PB12: «Panels/Status bar — Off (own pager)» — нижней панели нет, кнопки своего пейджера листают страницы', async () => {
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

  test('DS6: «Panels/Pagination — Server» — следующая страница и сортировка приходят с сервера, итог — из paginationRowCount; в журнале onPageChange и onToggleColumnSort', async () => {
    await render(<composed.PaginationServer serverDelayMs={100} />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    expect(byTestId('pagination-range')!.textContent).toBe('1–25 of 230')
    expect(firstRowName()).toBe('Alice 0')

    await humanClick(
      document.querySelector<HTMLElement>('[data-page-action="next"]')!,
    )
    await expect.poll(firstRowName).toMatch(/ 25$/)
    expect(byTestId('pagination-range')!.textContent).toBe('26–50 of 230')
    expect(log()).toContain('onPageChange')
    expect(log()).toContain('page 2 of 10')

    const nameHead = document.querySelector<HTMLElement>(
      '[role="columnheader"][data-column-id="name"]',
    )!
    await userEvent.hover(nameHead)
    await humanClick(
      nameHead.querySelector<HTMLElement>('.column-sort__button')!,
    )
    await expect.poll(log).toMatch(/page 2 of 10 by name (asc|desc)/)
    const sign = /by name desc/.test(log()) ? -1 : 1
    expect(log()).toContain('onToggleColumnSort')
    const sorted = () => {
      const names = orderedRows().map(row => nameOf(row)!)
      return names.every(
        (name, i) =>
          i === 0 ||
          sign *
            names[i - 1]!.localeCompare(name, undefined, { numeric: true }) <=
            0,
      )
    }
    await expect.poll(sorted).toBe(true)
    expect(byTestId('pagination-range')!.textContent).toBe('26–50 of 230')
  })
})
