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

/** Текст записи zip по локальным заголовкам; deflate — встроенным `DecompressionStream`. */
const zipEntryText = async (bytes: Uint8Array, name: string) => {
  const view = new DataView(bytes.buffer)
  for (let at = 0; view.getUint32(at, true) === 0x04034b50;) {
    const method = view.getUint16(at + 8, true)
    const size = view.getUint32(at + 18, true)
    const nameLength = view.getUint16(at + 26, true)
    const start = at + 30 + nameLength
    const entry = new TextDecoder().decode(bytes.slice(at + 30, start))
    if (entry === name) {
      const data = bytes.slice(start, start + size)
      const stream = new Blob([data]).stream()
      return new Response(
        method === 8
          ? stream.pipeThrough(new DecompressionStream('deflate-raw'))
          : stream,
      ).text()
    }
    at = start + size
  }
  return ''
}

const openPanel = async () => {
  await userEvent.click(button()!)
  await expect.poll(panel).not.toBeNull()
}

describe('Демо-история Export', () => {
  test('EX34: «Export — server» — выгрузка «Все строки» уходит в onExport, кнопка занята до ответа сервера; «Текущая страница» скачивается и пишет onExported', async () => {
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

  test('XL13: «Export — Excel» — выгрузка в Excel скачивает export.xlsx с данными грида', async () => {
    const names: string[] = []
    let blob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation(value => {
      blob = value as Blob
      return 'blob:export-excel-story'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download)
    })

    await render(<composed.ExportExcel />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    await openPanel()
    const xlsx = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="export-axis-format"] [role="radio"][data-value="xlsx"]',
      )
    await userEvent.click(xlsx()!)
    await expect.poll(() => xlsx()!.getAttribute('aria-checked')).toBe('true')
    await userEvent.click(run()!)

    await expect.poll(() => names).toEqual(['export.xlsx'])
    const bytes = new Uint8Array(await blob!.arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const firstCell = bodyRows()
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))[0]!
      .querySelector('.data-grid__body-cell')!
      .textContent!.trim()
    expect(await zipEntryText(bytes, 'xl/worksheets/sheet1.xml')).toContain(
      `<t xml:space="preserve">${firstCell}</t>`,
    )
  })
})
