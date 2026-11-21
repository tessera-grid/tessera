import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnSortingModel,
  dataExport,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { dataExportLabels } from '../../../plugins/dataExport/labels'
import { humanClick, pendingArcOf } from '../helpers'
import { tableLabels } from '../labels'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { recordAnnouncements } from './lazy-helpers'

// Выгрузка в серверной модели на гриде (ADR 0190): ожидание, отмена и смена выборки (XV6), отказ
// блока (XV7), панель с недоступными значениями (XV9).

const downloadFile = vi
  .spyOn(HTMLAnchorElement.prototype, 'click')
  .mockImplementation(() => {})

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const NO_DATA: Item[] = []
const TOTAL = 200
const BLOCK = 50

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const exportButton = () => q('[data-testid="export-button"]')!

const server = (hold: (start: number) => boolean) => {
  const held: {
    request: ServerRowsRequest
    go: (fail?: Error) => void
  }[] = []
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const { start, end } = request
      const go = (fail?: Error) =>
        fail
          ? reject(fail)
          : resolve({
              rows: Array.from(
                { length: Math.min(end, TOTAL) - start },
                (_, i) => ({ id: `r${start + i}`, name: `N${start + i}` }),
              ),
              rowCount: TOTAL,
            })
      if (hold(start)) held.push({ request, go })
      else go()
    })
  return { getRows, held }
}

const Grid = ({
  getRows,
  panel = false,
  onTable,
}: {
  getRows: (request: ServerRowsRequest) => Promise<ServerRowsResponse<Item>>
  panel?: boolean
  onTable?: (table: {
    setSorting: (sorting: { id: string; desc: boolean }[]) => void
  }) => void
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: BLOCK }),
      columnSortingModel(),
      rowSelection(),
      // Одна комбинация: кнопка выгружает сразу, без панели.
      dataExport(
        panel ? {} : { allow: { rows: ['view'], columns: ['visible'] } },
      ),
    ] as never,
  })
  onTable?.(table as never)
  return (
    <div style={{ width: 500, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const armed = () => exportButton().hasAttribute('data-cancel-armed')

describe('выгрузка в SSRM на гриде (ADR 0190)', () => {
  test('XV11: выгрузка, ждущая строк, бросается, когда таблица уходит со страницы: её запросы прерваны, файла нет', async () => {
    let holding = false
    const { getRows, held } = server(start => holding && start > 0)
    const screen = await render(<Grid getRows={getRows} />)
    vi.mocked(downloadFile).mockClear()
    await expect
      .poll(() => q('.data-grid__body-row[data-row-id="r0"]'))
      .not.toBeNull()
    await expect.poll(() => q('[data-testid="export-button"]')).not.toBeNull()
    holding = true
    await humanClick(exportButton())
    await expect.poll(() => held.length).toBeGreaterThan(0)

    await screen.unmount()
    expect(held.every(({ request }) => request.signal.aborted)).toBe(true)
    for (const { go } of held.splice(0)) go()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(downloadFile).not.toHaveBeenCalled()
  })

  test('XV6: кнопка занята, отмена и смена выборки прерывают запросы, файла нет', async () => {
    let holding = false
    const { getRows, held } = server(start => holding && start > 0)
    let table:
      | { setSorting: (sorting: { id: string; desc: boolean }[]) => void }
      | undefined
    const screen = await render(
      <Grid
        getRows={getRows}
        onTable={value => {
          table = value
        }}
      />,
    )
    vi.mocked(downloadFile).mockClear()
    try {
      await expect
        .poll(() => q('.data-grid__body-row[data-row-id="r0"]'))
        .not.toBeNull()
      await expect.poll(() => q('[data-testid="export-button"]')).not.toBeNull()
      holding = true

      // Ответ пришёл: файл скачан.
      await humanClick(exportButton())
      await expect.poll(() => pendingArcOf(exportButton())).not.toBeNull()
      expect(exportButton().getAttribute('aria-busy')).toBe('true')
      holding = false
      for (const { go } of held.splice(0)) go()
      await expect.poll(() => vi.mocked(downloadFile).mock.calls.length).toBe(1)
      await expect.poll(() => pendingArcOf(exportButton())).toBeNull()

      // Отмена «стопом».
      holding = true
      await humanClick(exportButton())
      await expect.poll(() => held.length).toBe(1)
      await userEvent.hover(exportButton())
      await expect.poll(armed).toBe(true)
      await humanClick(exportButton())
      await expect.poll(() => pendingArcOf(exportButton())).toBeNull()
      expect(held[0]!.request.signal.aborted).toBe(true)
      held.length = 0

      // Смена выборки.
      await expect.poll(() => armed()).toBe(false)
      await userEvent.unhover(exportButton())
      await humanClick(exportButton())
      await expect.poll(() => held.length).toBe(1)
      table!.setSorting([{ id: 'name', desc: true }])
      await expect.poll(() => pendingArcOf(exportButton())).toBeNull()
      expect(held[0]!.request.signal.aborted).toBe(true)
      expect(vi.mocked(downloadFile).mock.calls.length).toBe(1)
    } finally {
      await screen.unmount()
    }
  })

  test('XV7: отказ блока — причина на кнопке, файла нет', async () => {
    const { getRows, held } = server(start => start === BLOCK)
    const screen = await render(<Grid getRows={getRows} />)
    vi.mocked(downloadFile).mockClear()
    try {
      await expect
        .poll(() => q('.data-grid__body-row[data-row-id="r0"]'))
        .not.toBeNull()
      const announcements = recordAnnouncements()
      await humanClick(exportButton())
      await expect.poll(() => held.length).toBeGreaterThan(0)
      held.shift()!.go(new Error('Блок недоступен'))
      await expect.poll(() => pendingArcOf(exportButton())).toBeNull()
      await expect
        .poll(() => announcements.messages)
        .toContain(
          tableLabels.announceActionFailed(
            dataExportLabels(tableLabels).export,
            'Блок недоступен',
          ),
        )
      expect(downloadFile).not.toHaveBeenCalled()
    } finally {
      await screen.unmount()
    }
  })

  test('XV9: панель с недоступными значениями — axe с color-contrast в обеих темах', async () => {
    const { getRows } = server(() => false)
    const screen = await render(<Grid getRows={getRows} panel />)
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    try {
      await humanClick(exportButton())
      await expect.poll(() => q('[data-testid="export-panel"]')).not.toBeNull()
      expect(
        q('[data-testid="export-axis-rows"]')!.querySelector(
          '[aria-disabled="true"], [data-disabled]',
        ),
      ).not.toBeNull()
      await inBothThemes(async () => {
        expect(
          (await axe.run(q('[data-testid="export-panel"]')!, options))
            .violations,
        ).toEqual([])
      })
    } finally {
      await screen.unmount()
    }
  })
})
