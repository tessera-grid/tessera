import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

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
