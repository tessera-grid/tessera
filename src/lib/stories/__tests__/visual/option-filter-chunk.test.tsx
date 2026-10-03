import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import { humanClick } from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'

// Ленивый модуль панели вариантов (ADR 0048, SF22). Отдельный файл: модуль грузится
// один раз на документ, а каждый файл набора идёт в своём iframe. Загрузку видно по
// стилю CSS-модуля панели — dev-сервер Vite вставляет его вместе с модулем.

const DATA = [{ id: '1', name: 'Alice', status: 'won' }]

const Grid = ({ withOptions }: { withOptions: boolean }) => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
      ...(withOptions
        ? [
            {
              id: 'status',
              accessorKey: 'status',
              header: 'Status',
              options: [{ value: 'won', label: 'Won' }],
              filter: 'select',
            },
          ]
        : []),
    ] as never,
    data: DATA,
    plugins: [columnFiltering()],
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const optionsModuleLoaded = () =>
  !!document.querySelector(
    'style[data-vite-dev-id*="OptionFilterPanel.module.css"]',
  )

const openFilter = async (columnId: string) => {
  const head = document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"]`,
  )!
  await userEvent.hover(head)
  await humanClick(head.querySelector('.column-filter__button')!)
  await expect
    .poll(() => document.querySelector('[data-testid="filter-panel"]'))
    .not.toBeNull()
}

const settle = async () => {
  await nextFrame()
  await new Promise(resolve => setTimeout(resolve, 100))
}

describe('Option filter chunk', () => {
  test('SF22: the option panel module loads on the first opening of such a filter; a grid without option columns, and one not yet opened, does not load it', async () => {
    const textOnly = await render(<Grid withOptions={false} />)
    await waitForGrid()
    await openFilter('name')
    await settle()
    expect(optionsModuleLoaded()).toBe(false)
    await textOnly.unmount()

    await render(<Grid withOptions />)
    await waitForGrid()
    await settle()
    expect(optionsModuleLoaded()).toBe(false)

    await openFilter('status')
    await expect.poll(optionsModuleLoaded).toBe(true)
    await expect
      .poll(() => document.querySelector('[data-filter-type="select"]'))
      .not.toBeNull()
  })
})
