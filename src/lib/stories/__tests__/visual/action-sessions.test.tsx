import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { Stories, bodyRows, getScroller, headCells } from '../helpers'
import { makeData } from '../../__mocks__/data'
import {
  HANDLE,
  beginDrag,
  firePointer,
  nextFrame,
  rowIdOrder,
} from '../../rowDragging.dnd'

// Сессии действий (ADR 0040, SS2–SS4, SS11–SS13, SS15): завершение без результата
// доходит до колбэка отмены плагина с причиной, колбэк успеха не зовётся; черновик
// правки живёт в срезе плагина. SS1, SS5–SS6, SS14, SS16 — модульные
// (`src/lib/__tests__/actionSessions.dom.test.tsx`).

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 6,
  dataCount: 30,
}

const allow = () => true
const deny = () => false

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

const ageCell = () =>
  bodyRows()
    .find(row => row.dataset.index === '0')!
    .querySelector<HTMLElement>('.data-grid__body-cell[data-column-id="age"]')!

const draftInput = () =>
  document.querySelector<HTMLInputElement>(
    '.data-grid__body-row[data-index="0"] .data-grid__body-cell[data-column-id="age"] input',
  )

/** Открыть правку ячейки `age` первой строки и ввести `999`. */
const startEdit = async () => {
  await waitForGrid()
  const original = ageCell().textContent
  await userEvent.hover(ageCell())
  await userEvent.click(
    ageCell().querySelector<HTMLElement>('.cell__button button')!,
  )
  await expect.poll(() => ageCell().querySelector('input')).not.toBeNull()
  const input = ageCell().querySelector<HTMLInputElement>('input')!
  await userEvent.clear(input)
  await userEvent.type(input, '999')
  return original
}

/** Начать перетаскивание первой строки и довести её до четвёртой. */
const startRowDrag = async () => {
  await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
  const handle = bodyRows()[0].querySelector<HTMLElement>(HANDLE)!
  const { hx } = await beginDrag(handle)
  const target = bodyRows()[3].getBoundingClientRect()
  const y = target.top + target.height / 2
  firePointer('pointermove', document, hx, y)
  await nextFrame()
  await expect.poll(() => document.body.style.cursor).not.toBe('default')
  return { x: hx, y }
}

const columnIds = () => headCells().map(cell => cell.dataset.columnId)

/** Начать перетаскивание первой перетаскиваемой колонки вправо. */
const startColumnDrag = async () => {
  await waitForGrid()
  const cell = headCells().find(head => head.querySelector(HANDLE))!
  const handle = cell.querySelector<HTMLElement>(HANDLE)!
  const start = handle.getBoundingClientRect()
  const x = start.left + start.width / 2
  const y = start.top + start.height / 2
  firePointer('pointerdown', handle, x, y)
  await nextFrame()
  firePointer('pointermove', document, x + 6, y)
  await nextFrame()
  firePointer('pointermove', document, x + 200, y)
  await nextFrame()
  await expect.poll(() => document.body.style.cursor).toBe('grabbing')
  return { columnId: cell.dataset.columnId, x: x + 200, y }
}

/** Начать протяжку ручки ресайза первой колонки с ручкой на 80px. */
const startResize = async () => {
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
  return { columnId: cell.dataset.columnId, width, initial, mouse, x0 }
}

/** Колонки без смысловых данных: SS15 убирает одну из них посреди действия. */
const plainColumns = Array.from({ length: 5 }, (_, i) => ({
  id: `c${i}`,
  accessorKey: `c${i}`,
  header: `C${i}`,
  size: 150,
  enableDragging: true,
}))

describe('Сессии действий', () => {
  test('SS2: Escape при правке, перетаскивании строки и колонки зовёт колбэк отмены с cancel, без колбэка успеха', async () => {
    const onCellEdit = vi.fn()
    const onEditCancel = vi.fn()
    const edit = await render(
      <Stories.AllFeatures
        {...GRID}
        enableCellEditing
        cellEditingCanEdit={allow}
        onCellEdit={onCellEdit}
        onEditCancel={onEditCancel}
      />,
    )
    const original = await startEdit()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => ageCell().querySelector('input')).toBeNull()
    expect(ageCell().textContent).toBe(original)
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'age',
        reason: 'cancel',
        draft: '999',
      }),
    )
    await edit.unmount()

    const onRowDragCancel = vi.fn()
    const rows = await render(
      <Stories.AllFeatures
        {...GRID}
        enableRowDragging
        onRowDragCancel={onRowDragCancel}
      />,
    )
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    const before = rowIdOrder(document.body)
    const drop = await startRowDrag()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, drop.x, drop.y)
    await nextFrame()
    expect(rowIdOrder(document.body)).toEqual(before)
    expect(onRowDragCancel).toHaveBeenCalledWith({
      rowId: before[0],
      reason: 'cancel',
    })
    await rows.unmount()

    const onColumnDragEnd = vi.fn()
    const onColumnDragCancel = vi.fn()
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableColumnDragging
        onColumnDragEnd={onColumnDragEnd}
        onColumnDragCancel={onColumnDragCancel}
      />,
    )
    await waitForGrid()
    const order = columnIds()
    const column = await startColumnDrag()
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, column.x, column.y)
    await nextFrame()
    expect(columnIds()).toEqual(order)
    expect(onColumnDragEnd).not.toHaveBeenCalled()
    expect(onColumnDragCancel).toHaveBeenCalledWith({
      columnId: column.columnId,
      reason: 'cancel',
    })
  })

  test('SS11: запрет правки на лету закрывает редактор без сохранения и отдаёт черновик в onEditCancel с revoke', async () => {
    const onCellEdit = vi.fn()
    const onEditCancel = vi.fn()
    const args = {
      ...GRID,
      enableCellEditing: true,
      onCellEdit,
      onEditCancel,
    }
    const screen = await render(
      <Stories.AllFeatures {...args} cellEditingCanEdit={allow} />,
    )
    const original = await startEdit()

    await screen.rerender(
      <Stories.AllFeatures {...args} cellEditingCanEdit={deny} />,
    )
    await expect.poll(() => ageCell().querySelector('input')).toBeNull()
    expect(ageCell().textContent).toBe(original)
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(onEditCancel).toHaveBeenCalledTimes(1)
    expect(onEditCancel).toHaveBeenCalledWith(
      expect.objectContaining({
        columnId: 'age',
        reason: 'revoke',
        draft: '999',
      }),
    )
  })

  test('SS12: Escape во время ресайза отменяет его — ширина стартовая, onColumnResizeEnd не зовётся, onColumnResizeCancel с cancel', async () => {
    const onColumnResizeEnd = vi.fn()
    const onColumnResizeCancel = vi.fn()
    await render(
      <Stories.AllFeatures
        {...GRID}
        enableColumnResizing
        onColumnResizeEnd={onColumnResizeEnd}
        onColumnResizeCancel={onColumnResizeCancel}
      />,
    )
    const { columnId, width, initial, mouse, x0 } = await startResize()

    await userEvent.keyboard('{Escape}')
    await expect.poll(width).toBe(initial)
    mouse('mousemove', document, x0 + 160)
    mouse('mouseup', document, x0 + 160)
    await nextFrame()
    expect(width()).toBe(initial)
    expect(onColumnResizeEnd).not.toHaveBeenCalled()
    expect(onColumnResizeCancel).toHaveBeenCalledWith({
      columnId,
      reason: 'cancel',
    })
  })

  test('SS13: запрет перетаскивания или ресайза на лету зовёт колбэк отмены с revoke', async () => {
    const onRowDragCancel = vi.fn()
    const rowArgs = { ...GRID, enableRowDragging: true, onRowDragCancel }
    const rows = await render(<Stories.AllFeatures {...rowArgs} />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    const [rowId] = rowIdOrder(document.body)
    const drop = await startRowDrag()
    await rows.rerender(
      <Stories.AllFeatures {...rowArgs} rowDraggingEnable={false} />,
    )
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, drop.x, drop.y)
    await nextFrame()
    expect(onRowDragCancel).toHaveBeenCalledWith({ rowId, reason: 'revoke' })
    await rows.unmount()

    const onColumnDragCancel = vi.fn()
    const columnArgs = {
      ...GRID,
      enableColumnDragging: true,
      onColumnDragCancel,
    }
    const columns = await render(<Stories.AllFeatures {...columnArgs} />)
    const column = await startColumnDrag()
    await columns.rerender(
      <Stories.AllFeatures {...columnArgs} enableColumnDragging={false} />,
    )
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, column.x, column.y)
    await nextFrame()
    expect(onColumnDragCancel).toHaveBeenCalledWith({
      columnId: column.columnId,
      reason: 'revoke',
    })
    await columns.unmount()

    const onColumnResizeEnd = vi.fn()
    const onColumnResizeCancel = vi.fn()
    const resizeArgs = {
      ...GRID,
      enableColumnResizing: true,
      onColumnResizeEnd,
      onColumnResizeCancel,
    }
    const resize = await render(<Stories.AllFeatures {...resizeArgs} />)
    const { columnId, width, initial } = await startResize()
    await resize.rerender(
      <Stories.AllFeatures {...resizeArgs} enableColumnResizing={false} />,
    )
    await expect.poll(width).toBe(initial)
    expect(onColumnResizeEnd).not.toHaveBeenCalled()
    expect(onColumnResizeCancel).toHaveBeenCalledWith({
      columnId,
      reason: 'revoke',
    })
  })

  test('SS3: черновик правки переживает прокрутку — строка ушла из окна виртуализации и вернулась, редактор с тем же текстом', async () => {
    const onEditCancel = vi.fn()
    await render(
      <Stories.AllFeatures
        {...GRID}
        dataCount={300}
        enableCellEditing
        cellEditingCanEdit={allow}
        onEditCancel={onEditCancel}
      />,
    )
    await startEdit()

    const scroller = getScroller()
    scroller.scrollTop = scroller.scrollHeight
    await expect.poll(draftInput).toBeNull()
    await expect
      .poll(() => bodyRows().some(row => row.dataset.index === '0'))
      .toBe(false)

    scroller.scrollTop = 0
    await expect.poll(() => draftInput()?.value).toBe('999')
    expect(onEditCancel).not.toHaveBeenCalled()
  })

  test('SS4: черновик правки переживает смену страницы и сортировку', async () => {
    // `click()` не переносит фокус: страница и сортировка меняются не уходом фокуса
    // из редактора (уход фокуса — потеря фокуса, §3).
    const range = () =>
      document.querySelector('[data-testid="pagination-range"]')?.textContent
    const pageButton = (action: 'previous' | 'next') =>
      document.querySelector<HTMLElement>(`[data-page-action="${action}"]`)!
    const paged = await render(
      <Stories.AllFeatures
        {...GRID}
        dataCount={100}
        enablePagination
        enableCellEditing
        cellEditingCanEdit={allow}
      />,
    )
    await expect.poll(range).toBe('1–25 of 100')
    await startEdit()
    pageButton('next').click()
    await expect.poll(range).toBe('26–50 of 100')
    expect(draftInput()).toBeNull()
    pageButton('previous').click()
    await expect.poll(range).toBe('1–25 of 100')
    await expect.poll(() => draftInput()?.value).toBe('999')
    await paged.unmount()

    await render(
      <Stories.AllFeatures
        {...GRID}
        enableColumnSorting
        enableSortingRemoval
        enableCellEditing
        cellEditingCanEdit={allow}
      />,
    )
    await startEdit()
    const ageHead = headCells().find(cell => cell.dataset.columnId === 'age')!
    const sortButton = () =>
      ageHead.querySelector<HTMLElement>('.column-sort__button')!
    // Полный круг сортировки: оба направления и снова без сортировки.
    const sortState = () => ageHead.getAttribute('aria-sort')
    const seen = new Set<string | null>()
    for (
      let step = 0;
      step < 3 && (step === 0 || sortState() !== 'none');
      step++
    ) {
      const before = sortState()
      sortButton().click()
      // eslint-disable-next-line no-await-in-loop
      await expect.poll(sortState).not.toBe(before)
      seen.add(sortState())
    }
    expect([...seen].sort()).toEqual(['ascending', 'descending', 'none'])
    await expect.poll(() => draftInput()?.value).toBe('999')
  })

  test('SS15: строка или колонка ушла из данных посреди перетаскивания или ресайза — колбэк отмены с unavailable', async () => {
    const data = makeData({ shape: 'flat', count: 30 })
    const onRowDragCancel = vi.fn()
    const rowArgs = {
      ...GRID,
      enableRowDragging: true,
      onRowDragCancel,
      dataOverride: data,
    }
    const rows = await render(<Stories.AllFeatures {...rowArgs} />)
    await expect.poll(() => bodyRows().length).toBeGreaterThan(3)
    const [rowId] = rowIdOrder(document.body)
    const drop = await startRowDrag()
    await rows.rerender(
      <Stories.AllFeatures
        {...rowArgs}
        dataOverride={data.filter(row => row.id !== rowId)}
      />,
    )
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, drop.x, drop.y)
    await nextFrame()
    expect(onRowDragCancel).toHaveBeenCalledWith({
      rowId,
      reason: 'unavailable',
    })
    await rows.unmount()

    const onColumnDragCancel = vi.fn()
    const columnArgs = {
      ...GRID,
      enableColumnDragging: true,
      onColumnDragCancel,
      columnsOverride: plainColumns,
    }
    const columns = await render(<Stories.AllFeatures {...columnArgs} />)
    const column = await startColumnDrag()
    await columns.rerender(
      <Stories.AllFeatures
        {...columnArgs}
        columnsOverride={plainColumns.filter(c => c.id !== column.columnId)}
      />,
    )
    await expect.poll(() => document.body.style.cursor).toBe('default')
    firePointer('pointerup', document, column.x, column.y)
    await nextFrame()
    expect(onColumnDragCancel).toHaveBeenCalledWith({
      columnId: column.columnId,
      reason: 'unavailable',
    })
    await columns.unmount()

    const onColumnResizeEnd = vi.fn()
    const onColumnResizeCancel = vi.fn()
    const resizeArgs = {
      ...GRID,
      enableColumnResizing: true,
      onColumnResizeEnd,
      onColumnResizeCancel,
      columnsOverride: plainColumns,
    }
    const resize = await render(<Stories.AllFeatures {...resizeArgs} />)
    const { columnId } = await startResize()
    await resize.rerender(
      <Stories.AllFeatures
        {...resizeArgs}
        columnsOverride={plainColumns.filter(c => c.id !== columnId)}
      />,
    )
    await expect.poll(() => onColumnResizeCancel.mock.calls.length).toBe(1)
    expect(onColumnResizeEnd).not.toHaveBeenCalled()
    expect(onColumnResizeCancel).toHaveBeenCalledWith({
      columnId,
      reason: 'unavailable',
    })
  })
})
