import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnFiltering } from '../../../plugins'
import { humanClick, renderGrid, revealCellButtons } from '../helpers'
import { composed, rowMenuArgs } from '../stories'
import { headCellById, renderColumnPinning } from './column-pinning-helpers'
import { waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'

// Тултип инлайн-кнопок, открывающих поповер (ADR 0024, AM31): с панелью (фильтр) и с
// мини-меню (закрепление с обеих сторон) — как у обычной кнопки действия; тултип и
// подпись кебаба заголовка и строки (AM32).

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
    // Кнопка раскрывается по ширине (ADR 0076): наведение — после раскрытия.
    await revealCellButtons(head)
    await userEvent.hover(filter())
    await expect.poll(tooltipShown(tableLabels.filter)).toBe(true)

    await humanClick(filter())
    await expect
      .poll(() => document.querySelector('[data-testid="filter-panel"]'))
      .not.toBeNull()
    await expect.poll(tooltipShown(tableLabels.filter)).toBe(false)
    await userEvent.keyboard('{Escape}')
    await screen.unmount()

    const container = await renderColumnPinning()
    const cell = headCellById(container, 'firstName')
    const pin = () => cell.querySelector<HTMLElement>('.column-pin__button')!
    await revealCellButtons(cell)
    await userEvent.hover(pin())
    await expect.poll(tooltipShown(tableLabels.pin)).toBe(true)

    await humanClick(pin())
    await expect
      .poll(() => document.querySelectorAll('[role="menuitem"]').length)
      .toBeGreaterThan(0)
    await expect.poll(tooltipShown(tableLabels.pin)).toBe(false)
    await userEvent.keyboard('{Escape}')
  })

  test('AM32: кебаб заголовка и кебаб строки показывают тултип со своей подписью — «Column options» и «Row options» — и называются ею', async () => {
    const header = renderGrid({
      columnCount: 4,
      dataCount: 5,
      enableColumnSorting: true,
      enableHeaderActionMenu: true,
      headerActionMenuMode: 'always',
    })
    await waitForGrid()
    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id]',
    )!
    const headKebab = head.querySelector<HTMLElement>(
      `[aria-label="${tableLabels.headerMenu}"]`,
    )!
    await userEvent.hover(head)
    await userEvent.hover(headKebab)
    await expect.poll(tooltipShown(tableLabels.headerMenu)).toBe(true)
    await (await header).unmount()

    await render(<composed.RowActionsPlayground {...rowMenuArgs} />)
    const actionCell = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-cell[data-column-id="actionColumn__rowActions"]',
      )
    await expect.poll(actionCell).not.toBeNull()
    const rowKebab = actionCell()!.querySelector<HTMLElement>(
      '[aria-haspopup="menu"]',
    )!
    expect(rowKebab.getAttribute('aria-label')).toBe(tableLabels.rowMenu)
    await userEvent.hover(actionCell()!.closest('.data-grid__body-row')!)
    await userEvent.hover(rowKebab)
    await expect.poll(tooltipShown(tableLabels.rowMenu)).toBe(true)
  })
})

describe('Тултип кебаба после меню', () => {
  test('AM35: после Escape с клавиатуры тултип кебаба есть; после выбора пункта мышью фокус возвращается на кебаб без тултипа, указатель ушёл — тултипа нет', async () => {
    await render(<composed.RowActionsPlayground {...rowMenuArgs} />)
    await waitForGrid()
    const row = document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row',
    )[1]!
    const kebab = () =>
      row.querySelector<HTMLElement>(`[aria-label^="${tableLabels.rowMenu}"]`)!
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    const menuItems = () => [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ]
    const away = () =>
      userEvent.hover(
        document.querySelectorAll<HTMLElement>('.data-grid__body-row')[4]!,
      )

    // Открыли мышью, закрыли Escape — фокус вернулся с клавиатуры, тултип есть.
    await userEvent.hover(row)
    await expect
      .poll(() => row.querySelector(`[aria-label^="${tableLabels.rowMenu}"]`))
      .not.toBeNull()
    await humanClick(kebab())
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    expect(tooltipShown(tableLabels.rowMenu)()).toBe(false)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => menuItems().length).toBe(0)
    await expect.poll(tooltipShown(tableLabels.rowMenu)).toBe(true)
    await away()

    // Открыли и выбрали мышью — фокус вернулся на кебаб, тултипа нет и после ухода.
    await userEvent.hover(row)
    await humanClick(kebab())
    await expect.poll(() => menuItems().length).toBeGreaterThan(0)
    await humanClick(menuItems().find(el => el.textContent?.includes('Edit'))!)
    await expect.poll(() => menuItems().length).toBe(0)
    await expect.poll(() => document.activeElement).toBe(kebab())
    await sleep(400)
    expect(tooltipShown(tableLabels.rowMenu)()).toBe(false)
    await away()
    await sleep(400)
    expect(tooltipShown(tableLabels.rowMenu)()).toBe(false)
  })
})
