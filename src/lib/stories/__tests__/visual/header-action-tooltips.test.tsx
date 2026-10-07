import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import { humanClick } from '../helpers'
import { headCellById, renderColumnPinning } from './column-pinning-helpers'
import { waitForGrid } from './core-helpers'

// Тултип инлайн-кнопок, открывающих поповер (ADR 0024, AM31): с панелью (фильтр) и с
// мини-меню (закрепление с обеих сторон) — как у обычной кнопки действия.

/** Открыт ли тултип с этим текстом (у поповера тоже есть `data-side`). */
const tooltipShown = (text: string) => () =>
  [...document.querySelectorAll('[data-side]')].some(
    el => el.textContent?.trim() === text,
  )

const FilterGrid = () => {
  const table = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
    ] as never,
    data: [{ id: '1', name: 'Alice' }],
    plugins: [columnFiltering()],
  })
  return (
    <div style={{ height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Тултипы инлайн-кнопок с поповером', () => {
  test('AM31: инлайн-кнопки с панелью и с мини-меню показывают тултип с label при наведении и прячут его, когда поповер открыт', async () => {
    const screen = await render(<FilterGrid />)
    await waitForGrid()
    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="name"]',
    )!
    const filter = () =>
      head.querySelector<HTMLElement>('.column-filter__button')!
    await userEvent.hover(head)
    await userEvent.hover(filter())
    await expect.poll(tooltipShown('Filter')).toBe(true)

    await humanClick(filter())
    await expect
      .poll(() => document.querySelector('[data-testid="filter-panel"]'))
      .not.toBeNull()
    await expect.poll(tooltipShown('Filter')).toBe(false)
    await userEvent.keyboard('{Escape}')
    await screen.unmount()

    const container = await renderColumnPinning()
    const cell = headCellById(container, 'firstName')
    const pin = () => cell.querySelector<HTMLElement>('.column-pin__button')!
    await userEvent.hover(cell)
    await userEvent.hover(pin())
    await expect.poll(tooltipShown('Pin column')).toBe(true)

    await humanClick(pin())
    await expect
      .poll(() => document.querySelectorAll('[role="menuitem"]').length)
      .toBeGreaterThan(0)
    await expect.poll(tooltipShown('Pin column')).toBe(false)
    await userEvent.keyboard('{Escape}')
  })
})
