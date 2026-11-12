import type { ReactElement } from 'react'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnVisibility } from '../../../plugins/columnVisibility'
import { Stories, revealCellButtons } from '../helpers'
import axe from 'axe-core'

import { AXE_OPTIONS } from './a11y-helpers'
import { tableLabels } from '../labels'
import { columnVisibilityLabels } from '../../../plugins/columnVisibility/labels'
import {
  columnsMenu as menu,
  openColumnsMenu,
  openSettings,
  viewSettingsButton,
  viewSettingsReady,
  viewSettingsRow,
} from '../viewSettings'

// Плагин columnVisibility (ADR 0035, CV1–CV3, CV5, CV8, CV14–CV18 визуальные).
// Модель меню (CV4, CV6, CV7, CV10–CV13) — модульные тесты
// `src/lib/__tests__/columnVisibility.test.ts`. Состояние читается из DOM/ARIA
// (role, aria-*, data-column-id), а не из хешированных классов.

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 3,
  dataCount: 20,
}

const button = () => viewSettingsButton(document)
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
          'columnVisibility.columns': 'Колонки',
          'columnVisibility.searchColumns': 'Поиск',
          'columnVisibility.allColumns': 'Все колонки',
          'columnVisibility.selectedColumns': 'Выбрано {count}',
          'columnVisibility.resetColumns': 'Сбросить',
        }}
        icons={{ columns: CustomColumnsIcon }}
      />
    </div>
  )
}

const mount = async (node: ReactElement) => {
  const result = await render(node)
  // Поповер грузится лениво: ждём настоящий триггер Base UI.
  await expect.poll(() => viewSettingsReady()).toBe(true)
  return result
}

const openMenu = () => openColumnsMenu()

const KEBAB = `[aria-label="${tableLabels.headerMenu}"]`
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
  await revealCellButtons(kebabOf(id)!.closest('.data-grid__head-cell')!)
  await userEvent.click(kebabOf(id)!)
  await expect
    .poll(() => document.querySelectorAll('[role="menuitem"]').length)
    .toBeGreaterThan(0)
}

const renderPlugin = (args = {}) =>
  mount(<Stories.ColumnVisibilityPlayground {...GRID} {...args} />)

describe('columnVisibility', () => {
  test('CV1: the plugin adds a Columns section to View settings; without it or with enabled:false — none', async () => {
    const off = await render(
      <Stories.ColumnVisibilityPlayground
        {...GRID}
        enableColumnVisibility={false}
        enableColumnFiltering
        enableToolbar
      />,
    )
    await openSettings()
    expect(viewSettingsRow('filter')).not.toBeNull()
    expect(viewSettingsRow('columns')).toBeNull()
    await userEvent.keyboard('{Escape}')
    await off.unmount()

    await renderPlugin()
    await openSettings()
    expect(viewSettingsRow('columns')!.textContent).toContain(
      columnVisibilityLabels(tableLabels).columns,
    )
  })

  test('CV2: the Columns section opens the columns menu with focus in search; Escape closes View settings and returns focus to its button', async () => {
    await renderPlugin()
    await openMenu()
    await expect
      .poll(() => document.activeElement?.getAttribute('aria-label'))
      .toBe(columnVisibilityLabels(tableLabels).searchColumns)

    await userEvent.keyboard('{Escape}')
    await expect.poll(() => menu()).toBeNull()
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

  test('CV16: menu and section labels come from localization and the section icon from icons', async () => {
    await mount(<LocalizedGrid />)
    await openSettings()
    const row = viewSettingsRow('columns')!
    expect(row.textContent).toContain('Колонки')
    expect(
      row.querySelector('[data-testid="custom-columns-icon"]'),
    ).not.toBeNull()
    await openMenu()
    expect(menu()!.querySelector('input')!.getAttribute('placeholder')).toBe(
      'Поиск',
    )
    const actions = [...menu()!.querySelectorAll('button')].map(
      node => node.textContent,
    )
    expect(actions).toEqual(['Сбросить'])
    expect(
      menu()!.querySelector('[data-testid="column-visibility-all"]')!
        .textContent,
    ).toBe('Все колонки')
    expect(
      menu()!.querySelector('[data-testid="column-visibility-count"]')!
        .textContent,
    ).toBe('Выбрано 1')
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

  test('CV18: the Columns section is on and View settings is active while any column is hidden, at rest when all are visible', async () => {
    const onToggle = vi.fn()
    await renderPlugin({ onToggleColumnVisibility: onToggle })
    expect(button()!.hasAttribute('data-active')).toBe(false)

    await openMenu()
    await userEvent.click(checkbox('firstName'))
    await expect.poll(() => button()!.hasAttribute('data-active')).toBe(true)
    expect(onToggle).toHaveBeenCalledWith(['firstName'], false)
    await userEvent.keyboard('{Escape}')
    await openSettings()
    expect(viewSettingsRow('columns')!.hasAttribute('data-active')).toBe(true)

    await openMenu()
    await userEvent.click(checkbox('firstName'))
    await expect.poll(() => button()!.hasAttribute('data-active')).toBe(false)
  })

  test('CV14: the header kebab has Hide column (Hide group for a group); none for enableHiding:false', async () => {
    const onToggle = vi.fn()
    const flat = await renderPlugin({
      enableHeaderActionMenu: true,
      onToggleColumnVisibility: onToggle,
    })
    await openKebab('firstName')
    await userEvent.click(
      menuItem(columnVisibilityLabels(tableLabels).hideColumn)!,
    )
    await expect.poll(() => headIds()).not.toContain('firstName')
    expect(onToggle).toHaveBeenCalledWith(['firstName'], false)
    await flat.unmount()

    const nested = await renderPlugin({
      enableHeaderActionMenu: true,
      headerNesting: 'nested',
    })
    await openKebab('name')
    expect(
      menuItem(columnVisibilityLabels(tableLabels).hideColumn),
    ).toBeUndefined()
    await userEvent.click(
      menuItem(columnVisibilityLabels(tableLabels).hideGroup)!,
    )
    await expect.poll(() => headIds()).not.toContain('firstName')
    expect(headIds()).not.toContain('lastName')
    await nested.unmount()

    // enableHiding:false — пункта нет; у остальных он есть, у последней видимой тоже.
    await renderPlugin({
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
    await userEvent.click(
      menuItem(columnVisibilityLabels(tableLabels).hideColumn)!,
    )
    await expect.poll(() => headIds()).not.toContain('b')
    await openKebab('c')
    expect(
      menuItem(columnVisibilityLabels(tableLabels).hideColumn),
    ).toBeTruthy()
    await userEvent.keyboard('{Escape}')
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
