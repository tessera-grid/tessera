import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { cellSelection, rowSelection } from '../../../plugins'
import { IconButton } from '../../../ui/IconButton'
import { humanClick, pendingArcOf } from '../helpers'
import { contrast, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'
import { type Shot, snapshot } from './tree-lines-helpers'

// Дуга на заливках (ADR 0127, IR28): кнопка кита с дугой в ячейке — на каждой заливке тела
// и под кольцом активной ячейки. Различимость — по пикселям снимка.

interface Item {
  id: string
  name: string
}

const DATA: Item[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
}))

const RANGE = [
  {
    anchorRowId: 'r3',
    anchorColumnId: 'name',
    focusRowId: 'r3',
    focusColumnId: 'action',
  },
]

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  {
    id: 'action',
    header: 'Action',
    cell: () => (
      <IconButton pending label="Run">
        <span aria-hidden>R</span>
      </IconButton>
    ),
  },
]

let table: {
  highlight: (target: unknown) => unknown
  getRow: (id: string) => { toggleSelected: (value: boolean) => void }
}

const Grid = () => {
  const created = useCreateTable({
    enableKeyboardNavigation: true,
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: Item) => row.id,
    plugins: [
      rowSelection(),
      cellSelection({ cellSelection: RANGE as never }),
    ] as never,
  })
  table = created as unknown as typeof table
  return (
    <div style={{ width: 640, height: 420 }}>
      <DataGrid table={created as never} />
    </div>
  )
}

const cellOf = (row: string, column: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${row}"] .data-grid__body-cell[data-column-id="${column}"]`,
  )!
const buttonOf = (row: string) =>
  cellOf(row, 'action').querySelector<HTMLElement>('button')!

/** Цвет, которым залита ячейка: самый частый в её пикселях. */
const fillOf = (shot: Shot, cell: HTMLElement) => {
  const box = cell.getBoundingClientRect()
  const counts = new Map<string, number>()
  for (let x = box.left + 4; x < box.right - 4; x += 3)
    for (let y = box.top + 4; y < box.bottom - 4; y += 3) {
      const key = String(shot.rgb(x, y))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  const [top] = [...counts].sort((a, b) => b[1] - a[1])
  return [...top![0].split(',').map(Number), 1]
}

/** Самая контрастная к заливке точка контура кнопки. */
const arcContrast = (shot: Shot, cell: HTMLElement, button: HTMLElement) => {
  const fill = fillOf(shot, cell)
  const box = button.getBoundingClientRect()
  const toFill = (x: number, y: number) =>
    contrast([...shot.rgb(x, y), 1], fill)
  let best = 0
  for (let x = box.left; x < box.right; x++)
    for (const y of [box.top, box.top + 1, box.bottom - 2, box.bottom - 1])
      best = Math.max(best, toFill(x, y))
  for (let y = box.top; y < box.bottom; y++)
    for (const x of [box.left, box.left + 1, box.right - 2, box.right - 1])
      best = Math.max(best, toFill(x, y))
  return { best, fill: fill.slice(0, 3).join(',') }
}

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('Дуга на заливках (ADR 0127)', () => {
  test('IR28: дуга различима на выделении диапазона, подсветке, выбранной строке и у кольца фокуса ячейки — по пикселям в обеих темах, во всех оттенках дуги', async () => {
    await page.viewport(900, 720)
    const screen = await render(<Grid />)
    await waitForGrid()
    const fills = new Set<string>()
    const measure = (carriers: string[]) =>
      inBothThemes(async () => {
        // Заливка подсветки входит переходом — снимок по её концу.
        await new Promise(resolve => setTimeout(resolve, 400))
        for (const tone of [1, 2, 3, 4]) {
          for (const id of carriers) {
            const arc = pendingArcOf(buttonOf(id))!
            arc.style.animation = 'none'
            arc.style.setProperty(
              '--tsr-spinner-tone',
              `var(--tsr-comp-pending-spinner-${tone})`,
            )
          }
          const shot = await snapshot()
          for (const id of carriers) {
            const { best, fill } = arcContrast(
              shot,
              cellOf(id, 'action'),
              buttonOf(id),
            )
            fills.add(`${id}:${fill}`)
            expect(
              best,
              `${id}, оттенок ${tone}, заливка ${fill}`,
            ).toBeGreaterThanOrEqual(3)
          }
        }
      })

    table.getRow('r1').toggleSelected(true)
    table.highlight({ row: 'r2' })
    await expect
      .poll(() => cellOf('r3', 'action').getAttribute('data-cell-selected'))
      .toBe('true')
    await measure(['r0', 'r1', 'r2', 'r3'])

    // Нажатие снимает диапазон — кольцо фокуса отдельно от него.
    await humanClick(cellOf('r4', 'name'))
    await userEvent.keyboard('{ArrowRight}')
    await expect
      .poll(() => cellOf('r4', 'action').getAttribute('data-kn-active'))
      .toBe('true')
    await measure(['r4'])

    // Заливки разные: стенд проверил каждую, а не белую ячейку пять раз.
    for (const plain of [...fills].filter(item => item.startsWith('r0'))) {
      const fill = plain.split(':')[1]
      for (const id of ['r1', 'r2', 'r3'])
        expect(fills.has(`${id}:${fill}`), `${id} на ${fill}`).toBe(false)
    }
    await screen.unmount()
  })
})
