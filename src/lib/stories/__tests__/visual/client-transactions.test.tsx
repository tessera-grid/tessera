import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import '../../../ui/theme/theme.css'
import type { RowTransaction } from '../../../core/rowTransactions'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellEditing, cellSelection } from '../../../plugins'
import { startEditSession } from '../../../plugins/cellEditing/session'
import { humanClick, settleRowMotion } from '../helpers'

// Клиентская транзакция и новый data на гриде (ADR 0194, IU12): активная ячейка, выделение,
// правка и прокрутка держат свои строки.

interface Item {
  id: string
  name: string
}

const COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]
const ROWS: Item[] = Array.from({ length: 1000 }, (_, k) => ({
  id: `r${k}`,
  name: `N${k}`,
}))

interface GridTable {
  applyRowTransaction: (transaction: RowTransaction<Item>) => unknown
  store: { get: () => Record<string, unknown> }
  getRowSource: () => { byId: (id: string) => unknown }
}

let setRows: (next: Item[] | ((old: Item[]) => Item[])) => void = () => {}

const Grid = ({
  onTable,
  onEditCancel,
}: {
  onTable: (table: GridTable) => void
  onEditCancel?: (event: unknown) => void
}) => {
  const [data, setData] = useState(ROWS)
  setRows = setData
  const table = useCreateTable({
    enableKeyboardNavigation: true,
    columns: COLUMNS as never,
    data,
    onDataChange: setData,
    plugins: [cellSelection(), cellEditing({ onEditCancel })] as never,
  })
  onTable(table as unknown as GridTable)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const scroller = () => q('.data-grid__container')!
const nextFrame = () => new Promise(requestAnimationFrame)
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
  )
const rowById = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
const cell = (id: string) =>
  rowById(id)!.querySelector<HTMLElement>(
    '.data-grid__body-cell[data-column-id="name"]',
  )!
const indexOf = (id: string) => Number(rowById(id)?.dataset.index ?? -1)
const focusedRow = () =>
  (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
    '.data-grid__body-row',
  )?.dataset.rowId
/** Строки тела с выделенными ячейками. */
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
const item = (id: string): Item => ({ id, name: id })

const scrollToIndex = async (index: number) => {
  scroller().scrollTop = index * rowHeight()
  await nextFrame()
  await expect
    .poll(() => scroller().hasAttribute('data-fast-scrolling'), {
      timeout: 3000,
    })
    .toBe(false)
}

describe('Клиентская транзакция на гриде (ADR 0194)', () => {
  test('IU12: транзакция и новый data держат на своих строках активную ячейку, выделение, прокрутку и правку', async () => {
    let table!: GridTable
    const onEditCancel = vi.fn()
    const screen = await render(
      <Grid onTable={t => (table = t)} onEditCancel={onEditCancel} />,
    )
    try {
      // Активная ячейка с фокусом на строке r5.
      await expect.poll(() => rowById('r5')).not.toBeNull()
      await humanClick(cell('r5'))
      await expect.poll(focusedRow).toBe('r5')
      table.applyRowTransaction({ add: [item('n1')], index: 1 })
      await expect.poll(() => indexOf('r5')).toBe(6)
      await expect.poll(focusedRow).toBe('r5')
      // Строка активной ячейки удалена — ячейка у следующей.
      table.applyRowTransaction({ remove: ['r5'] })
      await expect.poll(() => rowById('r5')).toBeNull()
      await expect.poll(focusedRow).toBe('r6')

      // Выделение держит строки: вставка выше и новый data от приложения.
      await humanClick(cell('r10'))
      await userEvent.click(cell('r12'), { modifiers: ['Shift'] })
      await expect.poll(selectedRows).toEqual(['r10', 'r11', 'r12'])
      table.applyRowTransaction({ add: [item('n2')], index: 2 })
      await expect.poll(() => indexOf('r10')).toBe(11)
      expect(selectedRows()).toEqual(['r10', 'r11', 'r12'])
      setRows(old =>
        old.map(row => (row.id === 'r11' ? { ...row, name: 'x' } : row)),
      )
      await expect.poll(() => cell('r11').textContent).toBe('x')
      expect(selectedRows()).toEqual(['r10', 'r11', 'r12'])
      // Угол ушёл из данных — диапазон снят.
      table.applyRowTransaction({ remove: ['r12'] })
      await expect.poll(selectedRows).toEqual([])

      // Правка держит строку; удалённая строка отменяет правку с причиной.
      startEditSession(table, table.getRowSource().byId('r20') as never, {
        id: 'name',
      })
      await expect
        .poll(() => rowById('r20')?.querySelector('input'))
        .not.toBeNull()
      table.applyRowTransaction({ add: [item('n3')], index: 0 })
      await expect.poll(() => indexOf('r20')).toBe(21)
      expect(rowById('r20')!.querySelector('input')).not.toBeNull()
      table.applyRowTransaction({ remove: ['r20'] })
      await expect
        .poll(() => onEditCancel.mock.calls.at(-1)?.[0])
        .toMatchObject({ rowId: 'r20', reason: 'unavailable' })

      // Прокрутка держит первую строку экрана при смене выше неё.
      await scrollToIndex(300)
      const top = scroller().scrollTop
      const first = Math.floor(top / rowHeight())
      const anchored = (
        q(`.data-grid__body-row[data-index="${first}"]`) as HTMLElement
      ).dataset.rowId!
      table.applyRowTransaction({ add: [item('n4'), item('n5')], index: 10 })
      await expect
        .poll(() => Math.abs(scroller().scrollTop - (top + 2 * rowHeight())))
        .toBeLessThanOrEqual(1)
      expect(indexOf(anchored)).toBe(
        Math.round(scroller().scrollTop / rowHeight()),
      )
      table.applyRowTransaction({ remove: ['r50', 'r51', 'r52'] })
      await expect
        .poll(() => Math.abs(scroller().scrollTop - (top - rowHeight())))
        .toBeLessThanOrEqual(1)
      expect(indexOf(anchored)).toBe(
        Math.round(scroller().scrollTop / rowHeight()),
      )
      // У начала списка прокрутка не держит: новая строка сверху видна.
      await scrollToIndex(0)
      table.applyRowTransaction({ add: [item('n6')], index: 0 })
      await expect.poll(() => indexOf('n6')).toBe(0)
      expect(scroller().scrollTop).toBe(0)
      await settleRowMotion()
    } finally {
      await screen.unmount()
    }
  })
})
