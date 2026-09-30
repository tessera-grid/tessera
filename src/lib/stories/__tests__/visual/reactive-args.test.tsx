import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { Stories, bodyRows, headCells } from '../helpers'

// Аргументы фабрик на лету (ADR 0039, RX17–RX20, RX22–RX23): история
// перерисовывается с новым значением аргумента на том же экземпляре таблицы, и
// поведение меняется без пересоздания. Состояние читается из DOM-контракта.
// RX21 — модульный (`src/lib/__tests__/reactiveArgs.dom.test.tsx`).

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 6,
  dataCount: 30,
}

const statusBar = () =>
  document.querySelector('[data-testid="data-grid-status-bar"]')
const counter = () =>
  document.querySelector<HTMLElement>('[data-testid="selected-rows-count"]')
const kebabs = () =>
  document.querySelectorAll(
    '.data-grid__head-cell [aria-label="Column options"]',
  )
const actionCell = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__body-cell[data-column-id="actionColumn__rowActions"]',
  )
const selectedCells = () =>
  document.querySelectorAll('.data-grid__body-cell[data-cell-selected]').length
const rowHandles = () =>
  document.querySelectorAll('.data-grid__body-row .drag__handler--column')
    .length
const cellAt = (rowIndex: number, columnIndex: number) =>
  bodyRows()
    .find(row => row.dataset.index === String(rowIndex))!
    .querySelectorAll<HTMLElement>(
      '.data-grid__body-cell[data-kn-cell], .data-grid__body-cell',
    )[columnIndex]

/** Клик с зажатым Ctrl — добавление диапазона выделения. */
const ctrlClick = async (element: HTMLElement) => {
  await userEvent.keyboard('{Control>}')
  await userEvent.click(element)
  await userEvent.keyboard('{/Control}')
}

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

describe('Аргументы фабрик на лету', () => {
  test('RX17: selectedCount на лету показывает и прячет счётчик, а вместе с ним панель, если он был в ней один', async () => {
    const args = { ...GRID, enableRowSelection: true }
    const screen = await render(
      <Stories.SelectedCount
        {...args}
        enablePagination={false}
        showSelectedCount={false}
      />,
    )
    await waitForGrid()
    expect(statusBar()).toBeNull()

    await screen.rerender(
      <Stories.SelectedCount
        {...args}
        enablePagination={false}
        showSelectedCount
      />,
    )
    await expect.poll(counter).not.toBeNull()
    expect(statusBar()).not.toBeNull()

    await screen.rerender(
      <Stories.SelectedCount
        {...args}
        enablePagination={false}
        showSelectedCount={false}
      />,
    )
    await expect.poll(statusBar).toBeNull()
  })

  test('RX18: mode и threshold кебаба заголовка на лету меняют схлопывание', async () => {
    const args = {
      ...GRID,
      enableHeaderActionMenu: true,
      enableColumnSorting: true,
      enableColumnPinning: true,
    }
    const screen = await render(<Stories.AllFeatures {...args} />)
    await waitForGrid()
    // Порог по умолчанию 3: пин + сортировка остаются инлайн.
    expect(kebabs()).toHaveLength(0)

    await screen.rerender(
      <Stories.AllFeatures
        {...args}
        headerActionMenuOptions={{ mode: 'always' }}
      />,
    )
    await expect.poll(() => kebabs().length).toBeGreaterThan(0)

    await screen.rerender(
      <Stories.AllFeatures
        {...args}
        headerActionMenuOptions={{ threshold: 5 }}
      />,
    )
    await expect.poll(() => kebabs().length).toBe(0)
  })

  test('RX19: width и collapsedWidth колонки действий на лету меняют её ширину', async () => {
    const args = { ...GRID, enableRowActions: true }
    const screen = await render(
      <Stories.AllFeatures
        {...args}
        rowActionsOptions={{ width: 120, collapsedWidth: 56 }}
      />,
    )
    await expect.poll(actionCell).not.toBeNull()
    await expect
      .poll(() => actionCell()!.getBoundingClientRect().width)
      .toBe(120)

    await screen.rerender(
      <Stories.AllFeatures
        {...args}
        rowActionsOptions={{ width: 200, collapsedWidth: 56 }}
      />,
    )
    await expect
      .poll(() => actionCell()!.getBoundingClientRect().width)
      .toBe(200)
  })

  test('RX20: pageSizes на лету меняет варианты выбора; текущий размер вне списка остаётся', async () => {
    const args = { ...GRID, dataCount: 100 }
    const range = () =>
      document.querySelector('[data-testid="pagination-range"]')?.textContent
    const trigger = () =>
      document.querySelector<HTMLElement>('[data-testid="page-size-select"]')
    const optionTexts = () =>
      [...document.querySelectorAll('[role="option"]')].map(node =>
        node.textContent?.trim(),
      )
    const screen = await render(<Stories.Pagination {...args} />)
    await expect.poll(range).toBe('1–25 of 100')

    await screen.rerender(
      <Stories.Pagination {...args} paginationPageSizes={[10, 50]} />,
    )
    await expect.poll(trigger).not.toBeNull()
    await userEvent.click(trigger()!)
    await expect.poll(optionTexts).toEqual(['10', '25', '50'])
    expect(range()).toBe('1–25 of 100')
  })

  test('RX22: флаг multiRange у cellSelection на лету действует со следующего действия', async () => {
    const args = { ...GRID, enableCellSelection: true }
    const screen = await render(<Stories.AllFeatures {...args} />)
    await waitForGrid()
    await userEvent.click(cellAt(0, 1))
    await ctrlClick(cellAt(2, 1))
    await expect.poll(selectedCells).toBe(2)

    await screen.rerender(
      <Stories.AllFeatures
        {...args}
        cellSelectionOptions={{ multiRange: false }}
      />,
    )
    await userEvent.click(cellAt(0, 1))
    await ctrlClick(cellAt(2, 1))
    await expect.poll(selectedCells).toBe(1)
  })

  test('RX23: enable у rowDragging на лету включает и выключает перетаскивание строк', async () => {
    const args = { ...GRID, enableRowDragging: true }
    const screen = await render(
      <Stories.AllFeatures {...args} rowDraggingEnable={false} />,
    )
    await waitForGrid()
    await vi.waitFor(() => expect(bodyRows().length).toBeGreaterThan(0))
    expect(rowHandles()).toBe(0)

    await screen.rerender(<Stories.AllFeatures {...args} rowDraggingEnable />)
    await expect.poll(rowHandles).toBeGreaterThan(0)

    await screen.rerender(
      <Stories.AllFeatures {...args} rowDraggingEnable={false} />,
    )
    await expect.poll(rowHandles).toBe(0)
  })
})
