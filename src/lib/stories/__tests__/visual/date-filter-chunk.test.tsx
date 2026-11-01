import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import { humanClick } from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'

// Ленивый модуль календаря (ADR 0047, DF14). Отдельный файл: модуль грузится один раз
// на документ, а каждый файл набора идёт в своём iframe. Загрузку видно по стилю
// CSS-модуля панели даты — dev-сервер Vite вставляет его вместе с модулем.

const DATA = [{ id: '1', name: 'Alice', created: '2026-03-15' }]

const Grid = ({ withDates }: { withDates: boolean }) => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name' },
      ...(withDates
        ? [
            {
              id: 'created',
              accessorKey: 'created',
              header: 'Created',
              dataType: 'dateString',
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

const calendarModuleLoaded = () =>
  !!document.querySelector(
    'style[data-vite-dev-id*="DateFilterPanel.module.css"]',
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

describe('Date filter chunk', () => {
  test('DF14: the calendar module loads on the first opening of a date filter; a grid with filters but no date columns, and one not yet opened, does not load it', async () => {
    const textOnly = await render(<Grid withDates={false} />)
    await waitForGrid()
    await openFilter('name')
    await settle()
    expect(calendarModuleLoaded()).toBe(false)
    await textOnly.unmount()

    await render(<Grid withDates />)
    await waitForGrid()
    await settle()
    expect(calendarModuleLoaded()).toBe(false)

    await openFilter('created')
    await expect.poll(calendarModuleLoaded).toBe(true)
    await expect
      .poll(() => document.querySelector('[data-testid="filter-calendar"]'))
      .not.toBeNull()
  })
})
