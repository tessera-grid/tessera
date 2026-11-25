import { createElement } from 'react'
import { render } from 'vitest-browser-react'
import { afterEach, expect, test, vi } from 'vitest'

import { cancelPending } from '../../../core/cancellation'
import { useCreateTable } from '../../../core/useCreateTable'
import { dataExportModel } from '../../../plugins/dataExportModel'
import { xlsxFormat } from '../../../plugins/dataExportModel/xlsx'
import type { ExportData } from '../../../plugins/dataExportModel/types'

const data: ExportData = {
  columns: [
    { id: 'value', header: 'Value', pinned: 'start' },
    { id: 'text', header: 'Text' },
    { id: 'date', header: 'Date' },
  ],
  rows: Array.from({ length: 2001 }, (_, i) => [
    i,
    '<&>',
    new Date('2026-11-25T01:00:00Z'),
  ]),
}

const bytes = async (content: unknown) =>
  new Uint8Array(await (content as Blob).arrayBuffer())

afterEach(() => vi.unstubAllGlobals())

test('XZ1: XLSX без разрешения не создаёт Worker', async () => {
  const create = vi.fn()
  vi.stubGlobal('Worker', create)
  await xlsxFormat().serialize(data)
  await xlsxFormat({ worker: false }).serialize(data)
  expect(create).not.toHaveBeenCalled()
})

test('XZ2: XLSX из Worker совпадает с обычным файлом', async () => {
  const actual = Worker
  const create = vi.fn(function (url: URL | string, options?: WorkerOptions) {
    return new actual(url, options)
  })
  vi.stubGlobal('Worker', create)
  const options = { sheetName: 'Report', timeZone: 'Asia/Singapore' }
  const baseline = await xlsxFormat(options).serialize(data)
  const worker = await xlsxFormat({ ...options, worker: true }).serialize(data)
  expect(create).toHaveBeenCalledOnce()
  expect(await bytes(worker)).toEqual(await bytes(baseline))
})

test('XZ3: отмена экспорта завершает Worker, скачивания нет', async () => {
  const create = vi.fn()
  const terminate = vi.fn()
  vi.stubGlobal('Worker', function () {
    create()
    return { postMessage: vi.fn(), terminate }
  })
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  const format = xlsxFormat({ worker: true })
  const plugins = [dataExportModel({ formats: [format] })]
  const rows = Array.from({ length: 2001 }, (_, value) => ({ value }))
  const columns = [{ accessorKey: 'value', header: 'Value' }]
  let table: ReturnType<typeof useCreateTable> | undefined
  const Host = () => {
    table = useCreateTable({ data: rows, columns, plugins } as never)
    return null
  }
  try {
    await render(createElement(Host))
    const pending = (
      table as unknown as { exportData: () => Promise<void> }
    ).exportData()
    await expect.poll(() => create.mock.calls.length).toBe(1)
    expect(cancelPending(table as object, { kind: 'export' }, 'api')).toBe(1)
    await pending
    await expect.poll(() => terminate.mock.calls.length).toBe(1)
    expect(download).not.toHaveBeenCalled()
  } finally {
    download.mockRestore()
  }
})

test('XZ4: ошибка запуска Worker оставляет штатную выгрузку', async () => {
  const create = vi.fn(function () {
    throw new DOMException('blocked', 'SecurityError')
  })
  vi.stubGlobal('Worker', create)
  const fallback = await xlsxFormat({ worker: true }).serialize(data)
  expect(create).toHaveBeenCalledOnce()
  expect(await bytes(fallback)).toEqual(
    await bytes(await xlsxFormat().serialize(data)),
  )
})

test('XZ5: пользовательский разбор даты сохраняет штатную сериализацию', async () => {
  const create = vi.fn()
  vi.stubGlobal('Worker', create)
  const parseDate = vi.fn(() => new Date('2026-11-25T01:00:00Z'))
  const dates: ExportData = {
    columns: [
      {
        id: 'day',
        header: 'Day',
        dataType: { name: 'custom', base: 'date', parseDate },
      },
    ],
    rows: [['custom']],
  }
  const actual = await xlsxFormat({ worker: true }).serialize(dates)
  expect(create).not.toHaveBeenCalled()
  expect(parseDate).toHaveBeenCalledOnce()
  expect(await bytes(actual)).toEqual(
    await bytes(await xlsxFormat().serialize(dates)),
  )
})
