import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { bodyRows, humanClick } from '../helpers'
import { composed } from '../stories'

// Дымовой тест демо-истории «Filtering — server» (ADR 0045, FL37; по образцу ADR 0042):
// история рендерится, главный сценарий виден в интерфейсе и журнале колбэков.

const log = () =>
  document.querySelector<HTMLElement>('[data-testid="callback-log"]')!.innerText
const filteredCount = () =>
  document.querySelector('[data-testid="filtered-rows-count"]')?.textContent ??
  null
const firstRowName = () =>
  bodyRows()[0]?.querySelector('[data-column-id="name"]')?.textContent?.trim()

describe('Демо-история Filtering', () => {
  test('FL37: «Filtering — server» — фильтр и поиск пишут колбэки в журнал после дебаунса, данные перезапрашиваются, «показано N из M» из ответа', async () => {
    await render(<composed.FilteringServer serverDelayMs={200} />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    expect(firstRowName()).toBe('Alice 0')

    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="name"]',
    )!
    await userEvent.hover(head)
    await humanClick(head.querySelector('.column-filter__button')!)
    const input = () =>
      document.querySelector<HTMLInputElement>('[data-testid="filter-value"]')
    await expect.poll(input).not.toBeNull()
    await userEvent.type(input()!, 'bob')
    await userEvent.keyboard('{Escape}')

    await expect.poll(log).toContain('onFilterChange')
    expect(log()).toContain('"value":"bob"')
    await expect.poll(log).toContain('server')
    await expect.poll(firstRowName).toBe('Bob 1')
    expect(filteredCount()).toBe('Showing 29 of 200')

    const search = document.querySelector<HTMLInputElement>(
      '[data-testid="quick-search"]',
    )!
    await userEvent.type(search, 'paris')
    await expect.poll(log).toContain('onSearchChange')
    expect(log()).toContain('search="paris"')
    // Bob — каждая 7-я строка, Paris — каждая 5-я: оба — каждая 35-я.
    await expect.poll(filteredCount).toBe('Showing 6 of 200')
    expect(firstRowName()).toBe('Bob 15')
  })
})

describe('Демо-история Filtering — dates', () => {
  test('DF21: «Filtering — dates» — фильтр по date и datetime, пресет и смена timeZone меняют выборку и «показано N из M»', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Календарь открывается на 15 марта 2026 — дне первых 20 строк истории.
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 15, 12)))
    try {
      const screen = await render(<composed.FilteringDates timeZone="UTC" />)
      await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
      const openFilter = async (columnId: string) => {
        const head = document.querySelector<HTMLElement>(
          `.data-grid__head-cell[data-column-id="${columnId}"]`,
        )!
        await userEvent.hover(head)
        await humanClick(head.querySelector('.column-filter__button')!)
        await expect
          .poll(() => document.querySelector('[data-testid="filter-calendar"]'))
          .not.toBeNull()
      }
      const close = async () => {
        await userEvent.keyboard('{Escape}')
        await expect
          .poll(() => document.querySelector('[data-testid="filter-panel"]'))
          .toBeNull()
      }

      // datetime: 15 марта по UTC — все 20 строк.
      await openFilter('createdAt')
      await humanClick(
        document.querySelector('[data-day="2026-03-15"] button')!,
      )
      await expect.poll(filteredCount).toBe('Showing 20 of 60')
      await close()

      // В Токио строки после 15:00 UTC уходят на 16-е.
      await screen.rerender(<composed.FilteringDates timeZone="Asia/Tokyo" />)
      await expect.poll(filteredCount).toBe('Showing 14 of 60')

      // date: «до 1980 года» вдобавок к фильтру дат создания.
      await openFilter('birthDate')
      const item = () =>
        document.querySelector<HTMLElement>('[data-operator="before"]')
      await humanClick(
        document.querySelector(
          '[data-testid="filter-panel"] [data-testid="filter-operator"]',
        )!,
      )
      await expect.poll(item).not.toBeNull()
      await humanClick(item()!)
      await userEvent.selectOptions(
        document.querySelectorAll<HTMLSelectElement>(
          '[data-testid="filter-calendar"] select',
        )[1],
        '1980',
      )
      await humanClick(
        document.querySelector('[data-day="1980-03-01"] button')!,
      )
      await expect.poll(filteredCount).toMatch(/^Showing [1-9] of 60$/)
      await close()
    } finally {
      vi.useRealTimers()
    }
  })
})
