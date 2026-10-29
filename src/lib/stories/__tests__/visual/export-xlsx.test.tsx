import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  dataExport,
  exportFormats,
  type ExportFormat,
  type ExportOptions,
} from '../../../plugins/dataExport'
import { failureShownOn, humanClick } from '../helpers'
import { tableLabels } from '../labels'

// Экспорт в Excel (ADR 0073): асинхронный формат в кнопке (XL7) и выгрузка `.xlsx`
// настоящим кликом (XL9). Генератор и содержимое файла — модульные XL1–XL6, XL8, XL12;
// ленивая загрузка — `export-xlsx-lazy` (XL10). Скачивание перехватывается подменой
// `URL.createObjectURL` и `HTMLAnchorElement.click`.

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age' },
]
const DATA = [
  { id: '1', name: 'Ann', age: 30 },
  { id: '2', name: 'Bob', age: 41 },
]

interface Download {
  name: string
  blob: Blob
}

const captureDownloads = () => {
  const downloads: Download[] = []
  let lastBlob: Blob | undefined
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
    lastBlob = blob as Blob
    return 'blob:export-xlsx-test'
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ name: this.download, blob: lastBlob! })
  })
  return downloads
}

afterEach(() => vi.restoreAllMocks())

const Grid = ({ options }: { options: ExportOptions }) => {
  const table = useCreateTable({
    columns: COLUMNS,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    plugins: [dataExport(options)] as never,
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const button = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="export-button"]')

// Одна комбинация осей — клик выгружает сразу, без панели.
const DIRECT = { allow: { columns: ['visible' as const] } }

const renderGrid = async (options: ExportOptions) => {
  const screen = await render(<Grid options={options} />)
  await expect.poll(button).not.toBeNull()
  return screen
}

/** Формат, который отвечает, когда тест скажет. */
const deferredFormat = () => {
  const control = {
    resolve: (_content: string) => {},
    reject: (_error: Error) => {},
  }
  const format: ExportFormat = {
    id: 'slow',
    label: 'Slow',
    extension: 'txt',
    mimeType: 'text/plain',
    serialize: () =>
      new Promise<string>((resolve, reject) => {
        control.resolve = resolve
        control.reject = reject
      }),
  }
  return { format, control }
}

describe('dataExport — Excel', () => {
  test('XL7: serialize с Promise — кнопка ждёт до скачивания; отказ не логируется, на кнопке отметка отказа, onExported не вызван', async () => {
    const downloads = captureDownloads()
    const onExported = vi.fn()
    const ok = deferredFormat()
    const success = await renderGrid({
      ...DIRECT,
      formats: [ok.format],
      onExported,
    })

    await humanClick(button()!)
    await expect.poll(() => button()!.getAttribute('aria-busy')).toBe('true')
    expect(downloads).toHaveLength(0)
    ok.control.resolve('done')
    await expect.poll(() => downloads.length).toBe(1)
    expect(await downloads[0]!.blob.text()).toBe('done')
    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
    expect(onExported).toHaveBeenCalledTimes(1)
    await success.unmount()

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = deferredFormat()
    await renderGrid({ ...DIRECT, formats: [failing.format], onExported })
    expect(failureShownOn(button())).toBe(false)
    await humanClick(button()!)
    await expect.poll(() => button()!.getAttribute('aria-busy')).toBe('true')
    failing.control.reject(new Error('sheet broke'))
    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
    await expect.poll(() => failureShownOn(button())).toBe(true)
    expect(error).not.toHaveBeenCalled()
    expect(button()).toHaveAccessibleDescription(
      tableLabels.actionFailedRetry('sheet broke'),
    )
    expect(downloads).toHaveLength(1)
    expect(onExported).toHaveBeenCalledTimes(1)
  })

  test('XL9: с exportFormats.xlsx() панель предлагает Excel; выгрузка настоящим кликом скачивает <имя>.xlsx', async () => {
    const downloads = captureDownloads()
    await renderGrid({
      filename: 'people',
      formats: [exportFormats.csv(), exportFormats.xlsx()],
    })
    await humanClick(button()!)
    const xlsx = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="export-axis-format"] [role="radio"][data-value="xlsx"]',
      )
    await expect.poll(xlsx).not.toBeNull()
    expect(xlsx()!.textContent).toContain('Excel')
    await userEvent.click(xlsx()!)
    await expect.poll(() => xlsx()!.getAttribute('aria-checked')).toBe('true')
    await humanClick(
      document.querySelector<HTMLElement>('[data-testid="export-run"]')!,
    )

    await expect.poll(() => downloads.length).toBe(1)
    expect(downloads[0]!.name).toBe('people.xlsx')
    const bytes = new Uint8Array(await downloads[0]!.blob.arrayBuffer())
    // Подпись zip-архива: локальный заголовок `PK\x03\x04`.
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})

describe('dataExport — итог только на кнопке (ADR 0136)', () => {
  test('FB6: выгрузка с промисом — ожидание и отметка отказа только на кнопке; при успехе ни кнопка, ни таблица не вспыхивают', async () => {
    const flashes = () =>
      document.querySelectorAll(
        '[data-flash], [data-column-flash], [class*="linear-progress"][data-error-flash]',
      ).length
    captureDownloads()
    const ok = deferredFormat()
    const success = await renderGrid({ ...DIRECT, formats: [ok.format] })
    await humanClick(button()!)
    await expect.poll(() => button()!.getAttribute('aria-busy')).toBe('true')
    ok.control.resolve('done')
    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(flashes(), 'успех').toBe(0)
    expect(failureShownOn(button())).toBe(false)
    await success.unmount()

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = deferredFormat()
    await renderGrid({ ...DIRECT, formats: [failing.format] })
    await humanClick(button()!)
    failing.control.reject(new Error('sheet broke'))
    await expect.poll(() => failureShownOn(button())).toBe(true)
    expect(flashes(), 'отказ').toBe(0)
    expect(
      document.querySelectorAll('[data-failure-indicator][data-shown="true"]')
        .length,
      'отметка только на кнопке',
    ).toBe(1)
    error.mockRestore()
  })
})
