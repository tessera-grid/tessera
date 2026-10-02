import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { bodyRows } from '../helpers'
import { composed } from '../stories'

// Дымовой тест демо-истории «Export — server» (ADR 0044, EX34; по образцу ADR 0042):
// история рендерится, главный сценарий виден в интерфейсе и журнале колбэков.

afterEach(() => vi.restoreAllMocks())

const log = () =>
  document.querySelector<HTMLElement>('[data-testid="callback-log"]')!.innerText
const button = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="export-button"]')
const panel = () =>
  document.querySelector<HTMLElement>('[data-testid="export-panel"]')
const run = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="export-run"]')
const rowsRadio = (value: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="export-axis-rows"] [role="radio"][data-value="${value}"]`,
  )

const openPanel = async () => {
  await userEvent.click(button()!)
  await expect.poll(panel).not.toBeNull()
}

describe('Демо-история Export', () => {
  test('EX34: «Export — server» — выгрузка «Все данные» уходит в onExport, кнопка занята до ответа сервера; «Текущая страница» скачивается и пишет onExported', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export-story')
    const clicks = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    await render(<composed.ExportServer serverDelayMs={400} />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    await expect.poll(button).not.toBeNull()

    await openPanel()
    await userEvent.click(run()!)
    await expect.poll(() => button()!.getAttribute('aria-busy')).toBe('true')
    expect(log()).toContain('onExport')
    expect(log()).toContain('rows="all"')
    expect(clicks).not.toHaveBeenCalled()

    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
    expect(log()).toContain('export "all" ready')

    await openPanel()
    await userEvent.click(rowsRadio('page')!)
    await expect
      .poll(() => rowsRadio('page')!.getAttribute('aria-checked'))
      .toBe('true')
    await userEvent.click(run()!)
    await expect.poll(() => clicks.mock.calls.length).toBe(1)
    expect(log()).toContain('onExported')
    expect(log()).toContain('rows="page"')
    expect(log()).toContain('rowCount=25')
  })
})
