import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import { waitForGrid } from './core-helpers'

// Загрузка панели фильтра до клика (ADR 0045, FL40). Отдельный файл: модули грузятся
// один раз на документ. Загрузку видно по стилю CSS-модуля панели (у даты — календаря):
// dev-сервер Vite вставляет его вместе с модулем.

const DATA = [{ id: '1', created: '2026-03-15', status: 'lead' }]

const Grid = () => {
  const table = useCreateTable({
    columns: [
      {
        id: 'created',
        accessorKey: 'created',
        header: 'Created',
        dataType: 'dateString',
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        dataType: 'select',
      },
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

const moduleLoaded = (name: string) => () =>
  !!document.querySelector(`style[data-vite-dev-id*="${name}.module.css"]`)

const filterButton = (columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${columnId}"] .column-filter__button`,
  )!

describe('Фильтр колонки — загрузка панели заранее', () => {
  test('FL40: наведение на кнопку фильтра и фокус на ней загружают модуль её панели до клика', async () => {
    await render(<Grid />)
    await waitForGrid()
    expect(moduleLoaded('Calendar')()).toBe(false)
    expect(moduleLoaded('OptionFilterPanel')()).toBe(false)

    await userEvent.hover(filterButton('created'))
    await expect.poll(moduleLoaded('Calendar')).toBe(true)
    expect(moduleLoaded('OptionFilterPanel')()).toBe(false)

    filterButton('status').focus()
    await expect.poll(moduleLoaded('OptionFilterPanel')).toBe(true)
    expect(document.querySelector('[data-action-panel]')).toBeNull()
  })
})
