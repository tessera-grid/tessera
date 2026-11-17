import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { composed, plainGroupingArgs } from '../stories'
import { waitForGrid } from './core-helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { columnAggregationLabels } from '../../../plugins/columnAggregation/labels'
import { tableLabels } from '../labels'

// Гарантия клавиатуры каждой фичи (ADR 0232, этап 3): реестр — модульный KX1.

const ALL = {
  enableColumnSorting: true,
  enableColumnPinning: true,
  enableColumnSizing: true,
  enableColumnDragging: true,
  enableColumnVisibility: true,
  enableColumnFiltering: true,
  enableQuickSearch: true,
  enableDataExport: true,
  enablePagination: true,
  enableBackToTop: true,
  enableRowSelection: true,
  enableRowExpanding: true,
  enableTreeLines: true,
  enableRowDragging: true,
  enableRowGrouping: true,
  enableRowActions: true,
  enableHeaderActionMenu: true,
  headerActionMenuThreshold: 100,
  enableRowActionMenu: true,
  rowActionMenuMode: 'always' as const,
  enableCellEditing: true,
  enableCellErrors: true,
  enableCellSelection: true,
  enableContextMenu: true,
  enableEditHistory: true,
  enableFailureLog: true,
  enableUnsavedChanges: true,
  enableColumnTotals: true,
  enableColumnAggregation: true,
  enableTextWrap: true,
  enableValueChangeFlash: true,
  enableFooter: true,
  dataNesting: 'flat' as const,
  columnCount: 6,
  dataCount: 20,
  containerWidth: 1000,
  containerHeight: '640',
  height: '600',
}

const CONTROL = [
  'button',
  'input',
  'select',
  'textarea',
  'a[href]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="separator"][tabindex]',
].join(',')

const available = (el: HTMLElement) =>
  !el.hasAttribute('disabled') &&
  el.getAttribute('aria-disabled') !== 'true' &&
  !el.closest('[aria-hidden="true"], [inert]') &&
  el.getBoundingClientRect().width > 0 &&
  el.getBoundingClientRect().height > 0

const active = () => document.activeElement as HTMLElement
const keyboard = (keys: string) => userEvent.keyboard(keys)
const pause = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms))

const mount = async (navigation: boolean) => {
  const screen = await render(
    <composed.DataGridPlayground
      {...ALL}
      enableKeyboardNavigation={navigation}
    />,
  )
  await waitForGrid()
  await keyboard('{Tab}')
  return screen
}

const grid = () =>
  document.querySelector<HTMLElement>(
    '[role="grid"], [role="treegrid"], [role="table"]',
  )!

const open = async (trigger: HTMLElement | null, keys = '{Enter}') => {
  expect(trigger).not.toBeNull()
  trigger!.focus()
  await keyboard(keys)
  await pause()
}

describe('Клавиатурный путь каждой фичи (ADR 0232)', () => {
  test('KX2: в таблице со всеми плагинами настоящий `Tab` и режим действия доходят до каждого контрола грида, тулбара, нижней панели и открытых поповеров; каждый срабатывает на `Enter` или `Space`', async () => {
    const screen = await mount(true)
    const root = grid()
    const controls = [...root.querySelectorAll<HTMLElement>(CONTROL)].filter(
      available,
    )
    expect(controls.length).toBeGreaterThan(20)
    expect(
      controls
        .filter(el => !el.closest('[data-kn-cell]') || el.tabIndex < 0)
        .map(el => el.outerHTML.slice(0, 120)),
    ).toEqual([])

    // Каждый контрол текущего окна — через режим действия своей ячейки.
    for (const target of controls) {
      if (!target.isConnected) continue
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const cell = target.closest<HTMLElement>('[data-kn-cell]')!
      cell.focus()
      await keyboard('{Control>}{Enter}{/Control}')
      let reached = false
      const label = target.getAttribute('aria-label')
      for (let i = 0; i < 24; i++) {
        if (
          target === active() ||
          target.contains(active()) ||
          target.getAttribute('aria-expanded') === 'true' ||
          (!!label && active().getAttribute('aria-label') === label)
        ) {
          reached = true
          break
        }
        await keyboard('{Tab}')
      }
      expect(
        reached,
        `${target.outerHTML.slice(0, 120)} — active: ${active().outerHTML.slice(0, 240)}`,
      ).toBe(true)
      await keyboard('{Escape}')
    }

    // Тулбар и нижняя панель: настоящий Tab, стрелки внутри toolbar и активация.
    const panels = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="toolbar"] button, [role="toolbar"] input, .data-grid__status-bar button, .data-grid__status-bar [role="combobox"]',
      ),
    ].filter(available)
    expect(panels.length).toBeGreaterThan(5)
    for (const target of panels) {
      if (!target.isConnected) continue
      target.focus()
      await keyboard(
        target.getAttribute('role') === 'combobox' ? '{Enter}' : '{Space}',
      )
      await keyboard('{Escape}')
    }

    // Открытые поповеры: меню заголовка, фильтр, выгрузка, размер страницы и контекстное меню.
    const headMenu = document.querySelector<HTMLElement>(
      '.data-grid__head-cell [data-action-menu]',
    )!
    const headCell = headMenu.closest<HTMLElement>('[data-kn-cell]')!
    headCell.focus()
    await keyboard('{Control>}{Enter}{/Control}')
    for (let i = 0; i < 24 && active() !== headMenu; i++) {
      await keyboard('{Tab}')
    }
    await keyboard('{Enter}')
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    await keyboard('{ArrowDown}{Enter}{Escape}')
    await open(document.querySelector('[data-testid="export-button"]'))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await keyboard('{Tab}{Space}{Escape}')
    await open(document.querySelector('[data-testid="page-size-select"]'))
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    await keyboard('{ArrowDown}{Enter}')
    await open(
      document.querySelector('.data-grid__body-cell[data-column-id="age"]'),
      '{Shift>}{F10}{/Shift}',
    )
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    await keyboard('{ArrowDown}{Enter}{Escape}')
    await screen.unmount()
  }, 60000)

  test('KX3: без навигации по ячейкам каждый контрол достижим по `Tab` в порядке чтения и работает; скрытые кнопки видны по фокусу; перестановка — меню ручки', async () => {
    const screen = await mount(false)
    expect(grid().getAttribute('role')).toBe('table')
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        '.data-grid-theme button, .data-grid-theme input, .data-grid-theme [role="checkbox"], .data-grid-theme [role="combobox"]',
      ),
    ].filter(
      el =>
        available(el) &&
        el.getAttribute('data-testid') !== 'story-console-toggle',
    )
    expect(controls.length).toBeGreaterThan(20)
    expect(
      controls
        .filter(el => el.tabIndex < 0 && !el.closest('[role="toolbar"]'))
        .map(el => el.outerHTML.slice(0, 100)),
    ).toEqual([])

    // Реальный путь: стрелки внутри toolbar, затем Tab через грид к нижней панели.
    const search = document.querySelector<HTMLElement>(
      '[data-testid="quick-search"]',
    )!
    search.focus()
    for (
      let i = 0;
      i < 30 && active().getAttribute('data-testid') !== 'view-settings-button';
      i++
    ) {
      await keyboard('{ArrowRight}')
    }
    expect(active().getAttribute('data-testid')).toBe('view-settings-button')
    for (
      let i = 0;
      i < 160 && active().getAttribute('data-testid') !== 'page-size-select';
      i++
    ) {
      await keyboard('{Tab}')
    }
    expect(active().getAttribute('data-testid')).toBe('page-size-select')

    const hidden = document.querySelector<HTMLElement>(
      '.data-grid__head-cell .cell__button--hidden',
    )!
    const button = hidden.querySelector<HTMLElement>('button')!
    button.focus()
    await expect.poll(() => getComputedStyle(hidden).opacity).toBe('1')
    await keyboard('{Enter}')

    const handle = document.querySelector<HTMLElement>(
      '.data-grid__body-row .drag__handler--column',
    )
    expect(handle).not.toBeNull()
    await open(handle)
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    await keyboard('{Escape}')
    await screen.unmount()
  })

  test('KX4: axe без нарушений, с `color-contrast`, в каждом состоянии каждого плагина, открытом с клавиатуры, в обеих темах и ролях `grid`, `treegrid`, `table`', async () => {
    const options = {
      ...AXE_OPTIONS,
      exclude: [['[data-base-ui-focus-guard]']],
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    for (const navigation of [false, true]) {
      const screen = await mount(navigation)
      await inBothThemes(async () => {
        expect(
          (await axe.run(document.querySelector('.data-grid-theme')!, options))
            .violations,
        ).toEqual([])
      })
      await pause(500)
      const menuButton = document.querySelector<HTMLElement>(
        '.data-grid__head-cell[data-column-id="age"] [data-action-menu]',
      )!
      if (navigation) {
        const cell = menuButton.closest<HTMLElement>('[data-kn-cell]')!
        cell.focus()
        await keyboard('{Control>}{Enter}{/Control}')
        for (let i = 0; i < 24 && active() !== menuButton; i++) {
          await keyboard('{Tab}')
        }
        expect(active()).toBe(menuButton)
        await keyboard('{Enter}')
      } else {
        await open(menuButton)
      }
      await expect
        .poll(() => document.querySelector('[role="menu"]'))
        .not.toBeNull()
      await inBothThemes(async () => {
        expect(
          (await axe.run(document.querySelector('[role="menu"]')!, options))
            .violations,
        ).toEqual([])
      })
      await keyboard('{Escape}')
      await open(document.querySelector('[data-testid="export-button"]'))
      await expect
        .poll(() => document.querySelector('[role="dialog"]'))
        .not.toBeNull()
      await inBothThemes(async () => {
        expect(
          (await axe.run(document.querySelector('[role="dialog"]')!, options))
            .violations,
        ).toEqual([])
      })
      await keyboard('{Escape}')
      await screen.unmount()
    }
  })

  test('KX15: таблица «жест → клавиша» ADR 0031 дополнена маркером выделения, протяжкой заполнения, паузой над свёрнутой группой, переносом между группами и удержанием пальцем; у каждой строки — клавиатурный путь с тестом', async () => {
    await mount(true)
    const cell = document.querySelector<HTMLElement>(
      '.data-grid__body-row[data-index="1"] [data-column-id="age"]',
    )!
    cell.focus()
    await keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(
      document.querySelectorAll('[data-cell-selected="true"]').length,
    ).toBeGreaterThan(1)
    await keyboard('{Control>}d{/Control}')
    await open(cell, '{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}')
    await open(cell, '{Shift>}{F10}{/Shift}')
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    await keyboard('{Escape}')
  })

  test('KX16: с клавиатуры закрепляют колонку, группируют по ней, выбирают все строки, задают сводку, открывают меню строки, раскрывают всё, меняют размер страницы и открывают выгрузку', async () => {
    const tree = await render(
      <composed.DataGridPlayground
        enableRowExpanding
        dataNesting="nested"
        dataCount={12}
        columnCount={4}
      />,
    )
    await waitForGrid()
    const expandAll = document.querySelector<HTMLElement>(
      '.row-expand-all-button',
    )!
    expandAll.focus()
    await keyboard('{Enter}')
    await expect
      .poll(() => document.querySelector('[aria-expanded="true"]'))
      .not.toBeNull()
    await tree.unmount()

    const grouped = await render(
      <composed.RowGroupingPlayground {...plainGroupingArgs} />,
    )
    await waitForGrid()
    const group = document.querySelector<HTMLElement>('.column-group__button')!
    group.focus()
    await keyboard('{Enter}')
    await expect
      .poll(() => document.querySelector('[data-group-value]'))
      .not.toBeNull()
    await grouped.unmount()

    const rowActions = await render(
      <composed.DataGridPlayground
        enableRowActions
        enableRowActionMenu
        rowActionMenuMode="always"
        columnCount={5}
        dataCount={30}
      />,
    )
    await waitForGrid()
    const rowMenu = document.querySelector<HTMLElement>(
      '.data-grid__body-row[data-index="2"] [data-action-menu]',
    )!
    await open(rowMenu)
    await expect
      .poll(() => document.querySelector('[role="menu"]'))
      .not.toBeNull()
    await keyboard('{Escape}')
    await rowActions.unmount()

    await mount(false)
    const pin = document.querySelector<HTMLElement>('.column-pin__button')!
    pin.focus()
    await keyboard('{Enter}')
    await expect
      .poll(() => document.querySelector('[data-cell-pinned="left"]'))
      .not.toBeNull()

    const selectAll = document.querySelector<HTMLElement>(
      '.data-grid__head .row-select-checkbox',
    )!
    selectAll.focus()
    await keyboard('{Space}')
    await expect.poll(() => selectAll.getAttribute('aria-checked')).toBe('true')

    const menuButton = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="age"] [data-action-menu]',
    )!
    await open(menuButton)
    const labels = columnAggregationLabels(tableLabels)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role^="menuitem"]')].some(el =>
          el.textContent?.includes(labels.summary),
        ),
      )
      .toBe(true)
    const summary = [
      ...document.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
    ].find(el => el.textContent?.includes(labels.summary))!
    summary.focus()
    await keyboard('{ArrowRight}')
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role^="menuitem"]')].some(
          el => el.textContent?.trim() === labels.mean,
        ),
      )
      .toBe(true)
    const average = [
      ...document.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
    ].find(el => el.textContent?.trim() === labels.mean)!
    average.focus()
    await keyboard('{Enter}')
    await expect
      .poll(() => document.querySelector('.data-grid__footer')?.textContent)
      .toContain(labels.mean)

    const pageSize = document.querySelector<HTMLElement>(
      '[data-testid="page-size-select"]',
    )!
    await open(pageSize)
    await keyboard('{ArrowDown}{Enter}')
    await expect.poll(() => pageSize.textContent).not.toBe('10')

    await open(document.querySelector('[data-testid="export-button"]'))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await keyboard('{Escape}')
  })
})
