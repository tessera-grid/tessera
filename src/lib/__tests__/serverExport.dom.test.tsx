// @vitest-environment happy-dom
/**
 * Выгрузка в серверной модели без серверного режима (ADR 0190; XV1–XV5, XV8).
 * Запуск: npx vitest run --config vitest.node.config.ts serverExport
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RowSource } from '../core/rowSource'
import { useCreateTable } from '../core/useCreateTable'
import { __resetLogger } from '../util/logger'
import { downloadFile } from '../plugins/dataExportModel/download'
import { resolveAxes } from '../plugins/dataExportModel/settings'
import {
  columnSortingModel,
  dataExport,
  dataExportModel,
  pagination,
  rowExpanding,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../plugins'
import { dataExportModelLabels } from '../plugins/dataExportModel/labels'
import { ENGLISH_LABELS } from '../core/localization'

vi.mock('../plugins/dataExportModel/download', () => ({
  downloadFile: vi.fn(),
}))

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const NO_DATA: Item[] = []
const BLOCK = 10

let root: Root
let table: any
let requests: ServerRowsRequest[]
let total: number
let knownTotal: boolean

const getRows = async (
  request: ServerRowsRequest,
): Promise<ServerRowsResponse<Item>> => {
  requests.push(request)
  const { start, end, parentId } = request
  const count = parentId ? 2 : total
  const prefix = parentId ? `${parentId}.` : 'r'
  return {
    rows: Array.from(
      { length: Math.max(0, Math.min(end, count) - start) },
      (_, i) => ({
        id: `${prefix}${start + i}`,
        name: `${prefix}${start + i}`,
      }),
    ),
    ...(knownTotal || parentId ? { rowCount: count } : {}),
  }
}

const Grid = ({
  extra = [],
  maxLoadedRows,
  onExported,
}: {
  extra?: readonly unknown[]
  maxLoadedRows?: number
  onExported?: (request: { rowCount?: number }) => void
}) => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: BLOCK }),
      dataExport({ maxLoadedRows, onExported }),
      ...extra,
    ] as never,
  })
  return null
}

const source = () => table.getRowSource() as RowSource<any>
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 20)))
const show = async (first = 0, last = BLOCK - 1) => {
  act(() => source().observe!({ first, last, fast: false }))
  await settle()
}
const mount = async (props: Parameters<typeof Grid>[0] = {}) => {
  act(() => root.render(<Grid {...props} />))
  await show()
}
const statusOf = (id: string) =>
  (table.getPluginDiagnostics() as { id: string; status: string }[]).find(
    diagnostic => diagnostic.id === id,
  )?.status
const axis = () =>
  Object.fromEntries(
    resolveAxes(table)!.rows.map(choice => [
      choice.value,
      choice.disabled ? (choice.reason ?? 'off') : 'on',
    ]),
  )
const exportedCsv = () => {
  const [content] = vi.mocked(downloadFile).mock.calls.at(-1)!
  return String(content).trim().split(/\r?\n/).slice(1)
}

beforeEach(() => {
  requests = []
  total = 25
  knownTotal = true
  root = createRoot(document.createElement('div'))
  vi.mocked(downloadFile).mockClear()
})

afterEach(() => {
  act(() => root.unmount())
})

describe('выгрузка в SSRM без серверного режима (ADR 0190)', () => {
  it("XV1: SSRM без dataMode.export 'server' — плагины активны, dev-warn нет; all и selected недоступны с причиной serverRowModel", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetLogger()
    try {
      await mount({ extra: [rowSelection(), columnSortingModel()] })
      expect(statusOf('dataExport')).toBe('active')
      expect(axis()).toEqual({
        all: 'serverRowModel',
        view: 'on',
        selected: 'serverRowModel',
      })
      expect(
        warn.mock.calls.flat().filter(line => String(line).includes('Export')),
      ).toEqual([])
      expect(dataExportModel).toBeDefined()
    } finally {
      warn.mockRestore()
    }
  })

  it('XV2: page выгружается на клиенте с догрузкой незагруженных строк', async () => {
    await mount({ extra: [pagination({ initialPageSize: 15 })] })
    expect(axis().page).toBe('on')
    await act(() => table.exportData({ rows: 'page' }))
    expect(exportedCsv()).toHaveLength(15)
    expect(exportedCsv()[14]).toBe('r14')
  })

  it('XV3: view выгружает всю выборку в её порядке на всех страницах: корни и раскрытые ветки, свёрнутые ветки не входят', async () => {
    await mount({
      extra: [
        pagination({ initialPageSize: 10 }),
        rowExpanding({
          hasChildren: row => (row as { depth: number }).depth === 0,
        }),
      ],
    })
    act(() => source().byId('r1').toggleExpanded(true))
    await show()
    await act(() => table.exportData({ rows: 'view' }))
    const rows = exportedCsv()
    expect(rows).toHaveLength(27)
    expect(rows.slice(0, 5)).toEqual(['r0', 'r1', 'r1.0', 'r1.1', 'r2'])
    expect(rows.at(-1)).toBe('r24')
  })

  it('XV4: maxLoadedRows, по умолчанию 10 000: известный итог сверх предела — отказ с причиной без запросов', async () => {
    total = 10_001
    await mount()
    requests = []
    const message = dataExportModelLabels(ENGLISH_LABELS).exportTooManyRows
    await expect(table.exportData({ rows: 'view' })).rejects.toThrow(
      message(10_000),
    )
    expect(requests).toEqual([])
    act(() => root.unmount())

    root = createRoot(document.createElement('div'))
    total = 25
    await mount({ maxLoadedRows: 20 })
    requests = []
    await expect(table.exportData({ rows: 'view' })).rejects.toThrow(
      message(20),
    )
    expect(requests).toEqual([])
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('XV5: итог неизвестен — загрузка останавливается на пределе, отказ с причиной, файла нет', async () => {
    total = 500
    knownTotal = false
    await mount({ maxLoadedRows: 25 })
    requests = []
    await expect(table.exportData({ rows: 'view' })).rejects.toThrow(
      dataExportModelLabels(ENGLISH_LABELS).exportTooManyRows(25),
    )
    // Первый блок в кэше, запросы — до блока, где предел перейдён.
    expect(requests.map(request => request.start)).toEqual([10, 20])
    expect(downloadFile).not.toHaveBeenCalled()

    total = 23
    requests = []
    await act(() => table.exportData({ rows: 'view' }))
    expect(exportedCsv()).toHaveLength(23)
  })

  it('XV8: table.exportData идёт тем же путём, onExported получает число строк', async () => {
    const onExported = vi.fn()
    await mount({ onExported })
    await act(() => table.exportData())
    expect(onExported).toHaveBeenCalledTimes(1)
    expect(onExported.mock.calls[0]![0]).toMatchObject({ rowCount: 25 })
  })
})
