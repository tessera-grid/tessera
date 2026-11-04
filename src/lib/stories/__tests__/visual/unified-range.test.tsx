/**
 * Выделение на клиенте едет с углами (ADR 0180, UR3): после сортировки прямоугольник стоит
 * между теми же строками на новых местах, индексы в срезе пересчитаны; угол скрыт поиском —
 * диапазон не показан, снятие поиска его возвращает.
 */
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellSelection, columnSorting, quickSearch } from '../../../plugins'
import { humanClick, revealCellButtons } from '../helpers'

interface Item {
  id: string
  name: string
  city: string
}

// Имена по убыванию идут в обратном порядке: сортировка переставляет строки.
const DATA: Item[] = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  name: `N${i}`,
  city: i % 2 ? 'Oslo' : 'Rome',
}))
const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]

let table: any

const Grid = () => {
  table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      cellSelection(),
      columnSorting(),
      quickSearch({ debounceMs: 0 }),
    ] as never,
  })
  return (
    <div style={{ width: 600, height: 460 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const cell = (rowId: string, columnId: string) =>
  q(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
  )!
/** Строки тела с выделенными ячейками; призраки движения строк — вне строк тела. */
const selectedRows = () =>
  [
    ...new Set(
      [
        ...document.querySelectorAll<HTMLElement>(
          '.data-grid__body-row[data-row-id] .data-grid__body-cell[data-cell-selected="true"]',
        ),
      ].map(
        node =>
          node.closest<HTMLElement>('.data-grid__body-row')!.dataset.rowId!,
      ),
    ),
  ].sort()
const search = () => q<HTMLInputElement>('[data-testid="quick-search"]')!
const slice = () =>
  table.store.get().cellSelection as {
    anchorRowIndex?: number
    focusRowIndex?: number
  }[]

describe('выделение на клиенте едет с углами (ADR 0180)', () => {
  test('UR3: после сортировки и фильтра прямоугольник стоит между теми же строками-углами на новых местах, индексы в срезе пересчитаны; угол скрыт поиском — диапазон не показан, снятие поиска его возвращает', async () => {
    const screen = await render(<Grid />)
    try {
      await expect.poll(() => q('.data-grid__body-row')).not.toBeNull()
      await humanClick(cell('r1', 'name'))
      await userEvent.click(cell('r3', 'city'), { modifiers: ['Shift'] })
      await expect.poll(selectedRows).toEqual(['r1', 'r2', 'r3'])
      expect(slice()).toMatchObject([{ anchorRowIndex: 1, focusRowIndex: 3 }])

      // Сортировка по имени по убыванию: углы r1 и r3 — на местах 6 и 4.
      const head = q('.data-grid__head-cell[data-column-id="name"]')!
      await revealCellButtons(head)
      const sort = () =>
        head.querySelector<HTMLElement>('.column-sort__button')!
      await humanClick(sort())
      await expect.poll(() => head.getAttribute('aria-sort')).toBe('descending')
      await expect
        .poll(slice)
        .toMatchObject([{ anchorRowIndex: 6, focusRowIndex: 4 }])
      expect(selectedRows()).toEqual(['r1', 'r2', 'r3'])

      // Поиск скрыл угол r1 (город Oslo, искомый Rome): диапазона нет на экране.
      await userEvent.type(search(), 'Rome')
      await expect
        .poll(() => q('.data-grid__body-row[data-row-id="r1"]'))
        .toBeNull()
      expect(selectedRows()).toEqual([])
      expect(slice()).toHaveLength(1)

      // Поиск снят — диапазон снова между теми же строками.
      await userEvent.clear(search())
      await expect.poll(selectedRows).toEqual(['r1', 'r2', 'r3'])
    } finally {
      await screen.unmount()
    }
  })
})
