import type { ReactElement } from 'react'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnVisibility } from '../../../plugins/columnVisibility'
import { Stories } from '../helpers'
import axe from 'axe-core'

import { AXE_OPTIONS } from './a11y-helpers'

// Плагин columnVisibility (ADR 0035, CV1–CV3, CV5, CV8, CV14–CV18 визуальные).
// Модель меню (CV4, CV6, CV7, CV9–CV13) — модульные тесты
// `src/lib/__tests__/columnVisibility.test.ts`. Состояние читается из DOM/ARIA
// (role, aria-*, data-column-id), а не из хешированных классов.

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 3,
  dataCount: 20,
}

const button = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-testid="column-visibility-button"]',
  )
const menu = () =>
  document.querySelector<HTMLElement>('[data-testid="column-visibility-menu"]')
const menuRow = (id: string) =>
  menu()!.querySelector<HTMLElement>(`[data-column-id="${id}"]`)!
const checkbox = (id: string) =>
  menuRow(id).querySelector<HTMLElement>('[role="checkbox"]')!
const headIds = () =>
  [...document.querySelectorAll<HTMLElement>('.data-grid__head-cell')]
    .map(cell => cell.getAttribute('data-column-id'))
    .filter(Boolean)

// Сторис не пробрасывают localization/icons — CV16 рендерит грид напрямую.
const LOCALIZED_COLUMNS = [{ id: 'a', accessorKey: 'a', header: 'A' }]
const LOCALIZED_DATA = [{ id: '1', a: 'x' }]
const LOCALIZED_PLUGINS = [columnVisibility()] as const
const CustomColumnsIcon = () => <svg data-testid="custom-columns-icon" />

const LocalizedGrid = () => {
  const table = useCreateTable({
    columns: LOCALIZED_COLUMNS,
    data: LOCALIZED_DATA,
    enableToolbar: true,
    plugins: LOCALIZED_PLUGINS,
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid
        table={table as never}
        localization={{
          columns: 'Колонки',
          searchColumns: 'Поиск',
          showAllColumns: 'Показать все',
          resetColumns: 'Сбросить',
        }}
        icons={{ columns: CustomColumnsIcon }}
      />
    </div>
  )
}

const mount = async (node: ReactElement) => {
  const result = await render(node)
  // Поповер грузится лениво: ждём настоящий триггер Base UI.
  await expect
    .poll(() => button()?.hasAttribute('data-base-ui-click-trigger'))
    .toBe(true)
  return result
}

const openMenu = async () => {
  await userEvent.click(button()!)
  await expect.poll(() => menu()?.hasAttribute('data-open')).toBe(true)
}

const KEBAB = '[aria-label="Column options"]'
const kebabOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"] ${KEBAB}`,
  )
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    item => item.textContent?.trim() === text,
  )
const openKebab = async (id: string) => {
  await userEvent.keyboard('{Escape}')
  await userEvent.click(kebabOf(id)!)
  await expect
    .poll(() => document.querySelectorAll('[role="menuitem"]').length)
    .toBeGreaterThan(0)
}

const renderPlugin = (args = {}) =>
  mount(<Stories.ColumnVisibility {...GRID} {...args} />)

describe('columnVisibility', () => {
  test('CV1: the plugin adds a Columns button to the toolbar; without it or with enabled:false — none', async () => {
    const off = await render(
      <Stories.ColumnVisibility
        {...GRID}
        enableColumnVisibility={false}
        enableToolbar
      />,
    )
    await expect
      .poll(() => document.querySelector('[role="toolbar"]'))
      .not.toBeNull()
    expect(button()).toBeNull()
    await off.unmount()

    await renderPlugin()
    expect(button()!.getAttribute('aria-label')).toBe('Columns')
    expect(document.querySelector('[role="toolbar"]')!.contains(button())).toBe(
      true,
    )
  })

  test('CV2: the button opens the columns popover; Escape closes it and returns focus to the button', async () => {
    await renderPlugin()
    await openMenu()
    expect(menu()!.getAttribute('role')).toBe('dialog')
    expect(menu()!.getAttribute('aria-label')).toBe('Columns')
    await expect
      .poll(() => document.activeElement?.getAttribute('aria-label'))
      .toBe('Search columns')

    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => menu()?.hasAttribute('data-open') ?? false)
      .toBe(false)
    await expect.poll(() => document.activeElement).toBe(button())
  })

  test('CV3: the menu shows columns as a tree in display order; groups are indented by depth', async () => {
    await renderPlugin({ headerNesting: 'nested' })
    await openMenu()
    // Листья меню — в том же порядке, что колонки в строке грида (без служебных).
    const menuLeaves = [
      ...menu()!.querySelectorAll<HTMLElement>(
        '[data-column-id]:not([data-column-group])',
      ),
    ].map(row => row.dataset.columnId)
    const gridLeaves = [
      ...document
        .querySelector('.data-grid__body-row')!
        .querySelectorAll<HTMLElement>('.data-grid__body-cell'),
    ]
      .map(cell => cell.getAttribute('data-column-id')!)
      .filter(id => !id.startsWith('actionColumn'))
    expect(menuLeaves).toEqual(gridLeaves)

    const group = menuRow('info')
    expect(group.hasAttribute('data-column-group')).toBe(true)
    const indent = (id: string) =>
      parseFloat(
        getComputedStyle(menuRow(id).querySelector('label')!)
          .paddingInlineStart,
      )
    expect(indent('more-info')).toBeGreaterThan(indent('info'))
    expect(indent('age')).toBeGreaterThan(indent('more-info'))
  })

  test('CV5: a leaf checkbox hides and shows the column in the grid', async () => {
    await renderPlugin()
    await openMenu()
    expect(headIds()).toContain('firstName')

    await userEvent.click(checkbox('firstName'))
    await expect.poll(() => headIds()).not.toContain('firstName')
    expect(checkbox('firstName').getAttribute('aria-checked')).toBe('false')

    await userEvent.click(checkbox('firstName'))
    await expect.poll(() => headIds()).toContain('firstName')
  })

  test('CV8: a column with enableHiding:false is checked and disabled', async () => {
    await renderPlugin({
      columnsOverride: [
        { id: 'a', accessorKey: 'a', header: 'A', enableHiding: false },
        { id: 'b', accessorKey: 'b', header: 'B' },
      ],
      dataOverride: [{ id: '1', a: 'x', b: 'y' }],
    })
    await openMenu()
    expect(checkbox('a').getAttribute('aria-checked')).toBe('true')
    expect(checkbox('a').hasAttribute('data-disabled')).toBe(true)
    expect(checkbox('b').hasAttribute('data-disabled')).toBe(false)
  })

  test('CV16: menu labels come from localization and the icon from icons', async () => {
    await mount(<LocalizedGrid />)
    expect(button()!.getAttribute('aria-label')).toBe('Колонки')
    expect(
      button()!.querySelector('[data-testid="custom-columns-icon"]'),
    ).not.toBeNull()
    await openMenu()
    expect(menu()!.getAttribute('aria-label')).toBe('Колонки')
    expect(menu()!.querySelector('input')!.getAttribute('placeholder')).toBe(
      'Поиск',
    )
    const actions = [...menu()!.querySelectorAll('button')].map(
      node => node.textContent,
    )
    expect(actions).toEqual(['Показать все', 'Сбросить'])
  })

  test('CV17: the toolbar and the open menu pass axe', async () => {
    await renderPlugin()
    await openMenu()
    // Стражи фокуса Base UI (aria-hidden + tabindex=0) — штатная ловушка фокуса
    // поповера: фокус на них не задерживается и уходит внутрь. aria-hidden-focus
    // на них — ложное срабатывание, поэтому они вне контекста axe.
    const { violations } = await axe.run(
      {
        include: [document.querySelector('[role="toolbar"]')!, menu()!],
        exclude: [['[data-base-ui-focus-guard]']],
      },
      AXE_OPTIONS,
    )
    expect(violations.map(v => v.id)).toEqual([])
  })

  test('CV18: the Columns button is active while any column is hidden, at rest when all are visible', async () => {
    const onToggle = vi.fn()
    await renderPlugin({ onToggleColumnVisibility: onToggle })
    expect(button()!.hasAttribute('data-active')).toBe(false)

    await openMenu()
    await userEvent.click(checkbox('firstName'))
    await expect.poll(() => button()!.hasAttribute('data-active')).toBe(true)
    expect(onToggle).toHaveBeenCalledWith(['firstName'], false)

    await userEvent.click(checkbox('firstName'))
    await expect.poll(() => button()!.hasAttribute('data-active')).toBe(false)
  })

  test('CV14: the header kebab has Hide column (Hide group for a group); none for the last visible or enableHiding:false', async () => {
    const onToggle = vi.fn()
    const flat = await renderPlugin({
      enableHeaderActionMenu: true,
      onToggleColumnVisibility: onToggle,
    })
    await openKebab('firstName')
    await userEvent.click(menuItem('Hide column')!)
    await expect.poll(() => headIds()).not.toContain('firstName')
    expect(onToggle).toHaveBeenCalledWith(['firstName'], false)
    await flat.unmount()

    const nested = await renderPlugin({
      enableHeaderActionMenu: true,
      headerNesting: 'nested',
    })
    await openKebab('name')
    expect(menuItem('Hide column')).toBeUndefined()
    await userEvent.click(menuItem('Hide group')!)
    await expect.poll(() => headIds()).not.toContain('firstName')
    expect(headIds()).not.toContain('lastName')
    await nested.unmount()

    // enableHiding:false — пункта нет; защищённая видимая колонка не даёт c стать
    // последней, поэтому у c пункт остаётся.
    const last = await renderPlugin({
      enableHeaderActionMenu: true,
      columnsOverride: [
        { id: 'a', accessorKey: 'a', header: 'A', enableHiding: false },
        { id: 'b', accessorKey: 'b', header: 'B' },
        { id: 'c', accessorKey: 'c', header: 'C' },
      ],
      dataOverride: [{ id: '1', a: 'x', b: 'y', c: 'z' }],
    })
    expect(kebabOf('a')).toBeNull()
    await openKebab('b')
    await userEvent.click(menuItem('Hide column')!)
    await expect.poll(() => headIds()).not.toContain('b')
    // c — не последняя видимая (a защищена, но видима): пункт есть.
    await openKebab('c')
    expect(menuItem('Hide column')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await last.unmount()

    await renderPlugin({
      enableHeaderActionMenu: true,
      columnsOverride: [{ id: 'only', accessorKey: 'only', header: 'Only' }],
      dataOverride: [{ id: '1', only: 'x' }],
    })
    expect(kebabOf('only')).toBeNull()
  })

  test('CV15: a hidden pinned column returns to its pinned block when shown', async () => {
    await renderPlugin({ enableColumnPinning: true })
    const country = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="country"]',
      )
    await userEvent.hover(country()!)
    await userEvent.click(
      country()!.querySelector<HTMLElement>('.column-pin__button')!,
    )
    await expect
      .poll(() => country()?.getAttribute('data-cell-pinned'))
      .toBe('left')

    await openMenu()
    await userEvent.click(checkbox('country'))
    await expect.poll(() => country()).toBeNull()
    await userEvent.click(checkbox('country'))
    await expect
      .poll(() => country()?.getAttribute('data-cell-pinned'))
      .toBe('left')
  })
})
