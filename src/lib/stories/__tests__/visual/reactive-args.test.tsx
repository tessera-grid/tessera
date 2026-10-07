import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { Stories, bodyRows, headCells, humanClick } from '../helpers'
import {
  HANDLE,
  beginDrag,
  firePointer,
  nextFrame,
  rowIdOrder,
} from '../../rowDragging.dnd'

// Аргументы фабрик на лету (ADR 0039, RX8, RX11, RX14–RX20, RX22–RX23): история
// перерисовывается с новым значением аргумента на том же экземпляре таблицы, и
// поведение меняется без пересоздания. Состояние читается из DOM-контракта.
// Сужение (RX8, RX11) не переписывает сохранённое: вернули значение — вернулось
// прежнее. RX9–RX10, RX12–RX13, RX21 — модульные (`src/lib/__tests__/`).

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

  test('RX8: maxDepth ↓ показывает строки глубже предела свёрнутыми; вернули значение — строки снова раскрыты', async () => {
    const args = {
      ...GRID,
      enableRowExpanding: true,
      initialExpanded: true as const,
    }
    const rowIds = () => bodyRows().map(row => row.dataset.rowId)
    const screen = await render(
      <Stories.AllFeatures {...args} rowExpandingMaxDepth={3} />,
    )
    // Всё дерево раскрыто: item-id-0-0-0 — ребёнок строки глубины 1.
    await expect.poll(rowIds).toContain('item-id-0-0-0')

    await screen.rerender(
      <Stories.AllFeatures {...args} rowExpandingMaxDepth={1} />,
    )
    await expect.poll(rowIds).not.toContain('item-id-0-0-0')
    expect(rowIds()).toContain('item-id-0-0')

    await screen.rerender(
      <Stories.AllFeatures {...args} rowExpandingMaxDepth={3} />,
    )
    await expect.poll(rowIds).toContain('item-id-0-0-0')
  })

  test('RX11: canSelectCell сузился — невыбираемые ячейки не показаны выбранными; вернули — снова выбраны', async () => {
    const args = { ...GRID, enableCellSelection: true }
    const allowAll = () => true
    const denyAll = () => false
    const screen = await render(
      <Stories.AllFeatures
        {...args}
        cellSelectionOptions={{ canSelectCell: allowAll }}
      />,
    )
    await waitForGrid()
    await userEvent.click(cellAt(0, 1))
    await expect.poll(selectedCells).toBe(1)

    await screen.rerender(
      <Stories.AllFeatures
        {...args}
        cellSelectionOptions={{ canSelectCell: denyAll }}
      />,
    )
    await expect.poll(selectedCells).toBe(0)

    await screen.rerender(
      <Stories.AllFeatures
        {...args}
        cellSelectionOptions={{ canSelectCell: allowAll }}
      />,
    )
    await expect.poll(selectedCells).toBe(1)
  })

  test('RX14: перетаскивание строки или колонки, запрещённое посреди действия, отменяется как по Escape', async () => {
    const rowArgs = { ...GRID, enableRowDragging: true }
    const rows = await render(<Stories.AllFeatures {...rowArgs} />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    const before = rowIdOrder(document.body)
    const handle = bodyRows()[0].querySelector<HTMLElement>(HANDLE)!
    const { hx } = await beginDrag(handle)
    const target = bodyRows()[3].getBoundingClientRect()
    firePointer('pointermove', document, hx, target.top + target.height / 2)
    await nextFrame()
    await expect.poll(() => document.body.style.cursor).not.toBe('default')

    await rows.rerender(
      <Stories.AllFeatures {...rowArgs} rowDraggingEnable={false} />,
    )
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, hx, target.top + target.height / 2)
    await nextFrame()
    expect(rowIdOrder(document.body)).toEqual(before)
    await rows.unmount()

    const columnArgs = { ...GRID, enableColumnDragging: true }
    const columns = await render(<Stories.AllFeatures {...columnArgs} />)
    await waitForGrid()
    const columnIds = () => headCells().map(cell => cell.dataset.columnId)
    const order = columnIds()
    const columnHandle = headCells()
      .map(cell => cell.querySelector<HTMLElement>(HANDLE))
      .find(Boolean)!
    const start = columnHandle.getBoundingClientRect()
    const cx = start.left + start.width / 2
    const cy = start.top + start.height / 2
    firePointer('pointerdown', columnHandle, cx, cy)
    await nextFrame()
    firePointer('pointermove', document, cx + 6, cy)
    await nextFrame()
    firePointer('pointermove', document, cx + 200, cy)
    await nextFrame()
    await expect.poll(() => document.body.style.cursor).toBe('grabbing')

    await columns.rerender(
      <Stories.AllFeatures {...columnArgs} enableColumnDragging={false} />,
    )
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, cx + 200, cy)
    await nextFrame()
    expect(columnIds()).toEqual(order)
  })

  test('RX15: ресайз колонки, запрещённый посреди действия, отменяется как по Escape — ширина возвращается к исходной', async () => {
    const onColumnResizeEnd = vi.fn()
    const args = { ...GRID, enableColumnResizing: true, onColumnResizeEnd }
    const screen = await render(<Stories.AllFeatures {...args} />)
    await waitForGrid()
    const cell = headCells().find(head =>
      head.querySelector('.resize__handler--column'),
    )!
    const width = () => cell.getBoundingClientRect().width
    const initial = width()
    const grip = cell.querySelector<HTMLElement>('.resize__handler--column')!
    const r = grip.getBoundingClientRect()
    const x0 = r.left + r.width / 2
    const y = r.top + r.height / 2
    const mouse = (type: string, target: Element | Document, x: number) =>
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: type === 'mouseup' ? 0 : 1,
          clientX: x,
          clientY: y,
        }),
      )
    mouse('mousedown', grip, x0)
    await nextFrame()
    mouse('mousemove', document, x0 + 80)
    await nextFrame()
    await expect.poll(width).toBeGreaterThan(initial + 40)

    await screen.rerender(
      <Stories.AllFeatures {...args} enableColumnResizing={false} />,
    )
    await expect.poll(width).toBe(initial)
    mouse('mousemove', document, x0 + 160)
    mouse('mouseup', document, x0 + 160)
    await nextFrame()
    expect(width()).toBe(initial)
    expect(onColumnResizeEnd).not.toHaveBeenCalled()
  })

  test('RX16: canEdit стал false при открытом редакторе — редактор закрывается, значение не сохраняется', async () => {
    const allow = () => true
    const deny = () => false
    const args = { ...GRID, enableCellEditing: true }
    const screen = await render(
      <Stories.AllFeatures {...args} cellEditingCanEdit={allow} />,
    )
    await waitForGrid()
    const cell = () =>
      bodyRows()
        .find(row => row.dataset.index === '0')!
        .querySelector<HTMLElement>(
          '.data-grid__body-cell[data-column-id="age"]',
        )!
    const original = cell().textContent
    await userEvent.hover(cell())
    await humanClick(cell().querySelector<HTMLElement>('.cell__button button')!)
    await expect.poll(() => cell().querySelector('input')).not.toBeNull()
    const input = cell().querySelector<HTMLInputElement>('input')!
    await userEvent.clear(input)
    await userEvent.type(input, '999')

    await screen.rerender(
      <Stories.AllFeatures {...args} cellEditingCanEdit={deny} />,
    )
    await expect.poll(() => cell().querySelector('input')).toBeNull()
    expect(cell().textContent).toBe(original)
  })
})
