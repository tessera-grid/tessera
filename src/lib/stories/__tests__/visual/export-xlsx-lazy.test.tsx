import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { dataExport, exportFormats } from '../../../plugins/dataExport'
import { humanClick } from '../helpers'
import { heldRequests, holdModule, releaseModule } from './lazy-helpers'

// Генератор `.xlsx` грузится при первой выгрузке в Excel, а не при монтировании
// (ADR 0073, XL10). Отдельный файл: модуль грузится один раз на документ.

const MODULE = 'xlsxBuild.ts'

afterEach(async () => {
  await releaseModule(MODULE)
  vi.restoreAllMocks()
})

const Grid = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }],
    data: [{ id: '1', name: 'Ann' }],
    getRowId: (row: { id: string }) => row.id,
    plugins: [
      dataExport({
        formats: [exportFormats.xlsx()],
        allow: { columns: ['visible'] },
      }),
    ] as never,
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const button = () =>
  document.querySelector<HTMLButtonElement>('[data-testid="export-button"]')

describe('dataExport — ленивый генератор Excel', () => {
  test('XL10: генератор .xlsx грузится при первой выгрузке, не при монтировании; кнопка ждёт загрузки', async () => {
    const names: string[] = []
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:xlsx-lazy')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download)
    })
    await holdModule(MODULE)
    await render(<Grid />)
    await expect.poll(button).not.toBeNull()
    // Даём ленивым модулям тулбара шанс загрузиться — генератора среди них нет.
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(await heldRequests(MODULE)).toBe(0)

    await humanClick(button()!)
    await expect.poll(() => heldRequests(MODULE)).toBeGreaterThan(0)
    expect(button()!.getAttribute('aria-busy')).toBe('true')
    expect(names).toEqual([])

    await releaseModule(MODULE)
    await expect.poll(() => names).toEqual(['export.xlsx'])
    await expect.poll(() => button()!.hasAttribute('aria-busy')).toBe(false)
  })
})
