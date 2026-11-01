import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import { humanClick } from '../helpers'
import { waitForGrid } from './core-helpers'
import { MODULE, holdModule, releaseModule, sleep } from './lazy-helpers'

// Инлайн-кнопка с панелью до загрузки модуля поповера (ADR 0061, LZ24): кнопка
// фильтра колонки. Отдельный файл: модуль грузится один раз на документ.

afterEach(() => releaseModule(MODULE.panel))

const Grid = () => {
  const table = useCreateTable({
    columns: [{ id: 'name', accessorKey: 'name', header: 'Name' }] as never,
    data: [{ id: '1', name: 'Alice' }],
    plugins: [columnFiltering()],
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const head = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="name"]',
  )!
const button = () =>
  head().querySelector<HTMLElement>('.column-filter__button')!
const panel = () => document.querySelector('[data-testid="filter-panel"]')

describe('Инлайн-кнопка с панелью — загрузка модуля поповера', () => {
  test('LZ24: клик по инлайн-кнопке с панелью до загрузки модуля поповера не теряется — поповер открывается после загрузки модуля и содержимого; ожидание видно на кнопке', async () => {
    await holdModule(MODULE.panel)
    await render(<Grid />)
    await waitForGrid()

    await userEvent.hover(head())
    await humanClick(button())
    await expect.poll(() => button().getAttribute('aria-busy')).toBe('true')
    await sleep(50)
    expect(panel()).toBeNull()

    await releaseModule(MODULE.panel)
    await expect.poll(panel).not.toBeNull()
    expect(button().getAttribute('aria-busy')).toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
  })
})
