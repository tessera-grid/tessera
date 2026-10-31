import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import type { BodyEventTarget } from '../../../core/bodyContributions'
import { useCreateTable } from '../../../core/useCreateTable'
import { BodyCell } from '../../../grid/BodyCell'
import { BodyRow } from '../../../grid/BodyRow'
import { DataGrid } from '../../../grid/DataGrid'
import { cellSelection, rowSelection } from '../../../plugins'
import { describeWork, measureWork, renders } from '../work.helpers'
import { waitForGrid } from './core-helpers'

// Канал вклада плагинов в тело (ADR 0170, §3): выделение ячеек и выбор строк вносят в ячейку
// и строку только атрибуты по выбору из состояния, события над телом приходят от корня.

const pointer = commands as unknown as {
  realDragHold: (
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps?: number,
  ) => Promise<void>
  realMouseUp: () => Promise<void>
}

const COLUMNS = ['a', 'b', 'c', 'd'].map(id => ({
  id,
  accessorKey: id,
  header: id.toUpperCase(),
  size: 120,
}))
const DATA = Array.from({ length: 8 }, (_, index) => ({
  id: `r${index}`,
  a: `A${index}`,
  b: `B${index}`,
  c: `C${index}`,
  d: `D${index}`,
}))

type Logged = [event: string, rowId?: string, columnId?: string]

/** Свой плагин: записывает события над телом, которые ему отдаёт корень грида. */
const eventProbe = (log: Logged[]) => {
  const record =
    (name: string) =>
    (_event: Event, { row, cell }: BodyEventTarget) =>
      log.push([name, row?.id, cell?.column.id])
  return {
    id: 'eventProbe',
    diagnose: () => undefined,
    body: {
      root: {
        id: 'eventProbe',
        events: {
          mousedown: record('mousedown'),
          hover: record('hover'),
          copy: record('copy'),
          contextmenu: record('contextmenu'),
        },
      },
    },
  }
}

let captured: any

const Grid = ({ log = [] }: { log?: Logged[] }) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: DATA,
    getRowId: (row: { id: string }) => row.id,
    enableKeyboardNavigation: true,
    plugins: [rowSelection(), cellSelection(), eventProbe(log)] as never,
  })
  captured = table
  return (
    <div style={{ width: 640, height: 400 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const cell = (rowId: string, columnId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"] .data-grid__body-cell[data-column-id="${columnId}"]`,
  )!
const row = (rowId: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${rowId}"]`,
  )!
const selectedCells = () =>
  document.querySelectorAll('.data-grid__body-cell[data-cell-selected="true"]')
    .length
const center = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** Обработчики React на элементе: свои пропсы `on*` ячейки и строки. */
const reactHandlers = (element: Element) => {
  const key = Object.keys(element).find(name =>
    name.startsWith('__reactProps$'),
  )!
  const props = (element as unknown as Record<string, Record<string, unknown>>)[
    key
  ]
  return Object.keys(props).filter(
    name => /^on[A-Z]/.test(name) && typeof props[name] === 'function',
  )
}

describe('канал вклада в тело (ADR 0170)', () => {
  test('CH6: смена среза перерисовывает только ячейки и строки, чей вклад изменился, — по счётчикам работы', async () => {
    await render(<Grid />)
    await waitForGrid()
    const grid = document.querySelector('[role="grid"]')!
    await userEvent.click(cell('r1', 'a'))
    await expect.poll(selectedCells).toBe(1)

    // Shift-клик: диапазон 2×2 — меняется вклад якоря (края) и трёх новых ячеек.
    const range = await measureWork(grid, async () => {
      await userEvent.click(cell('r2', 'b'), { modifiers: ['Shift'] } as never)
      await expect.poll(selectedCells).toBe(4)
    })
    expect(renders(range, BodyCell), describeWork(range)).toBe(4)
    expect(renders(range, BodyRow), describeWork(range)).toBe(0)

    // Выбор строки меняет `aria-selected` только у неё; вклад ячеек прежний. Выбор — API:
    // нажатие по флажку сдвинуло бы ещё и активную ячейку навигации.
    const selection = await measureWork(grid, async () => {
      captured.getRow('r4').toggleSelected(true)
      await expect
        .poll(() => row('r4').getAttribute('aria-selected'))
        .toBe('true')
    })
    expect(renders(selection, BodyRow), describeWork(selection)).toBe(1)
    expect(renders(selection, BodyCell), describeWork(selection)).toBe(0)
  })

  test('CH7: нажатие, наведение, копирование и контекстное меню над телом плагин получает делегированием от корня грида со строкой и ячейкой события; своих обработчиков от плагинов у ячейки и строки нет', async () => {
    const log: Logged[] = []
    await render(<Grid log={log} />)
    await waitForGrid()

    // Протяжка настоящей мышью: выделение ячеек по делегированным нажатию и наведению.
    await pointer.realDragHold(center(cell('r1', 'a')), center(cell('r2', 'b')))
    await pointer.realMouseUp()
    await expect.poll(selectedCells).toBe(4)
    expect(log).toContainEqual(['mousedown', 'r1', 'a'])
    expect(log).toContainEqual(['hover', 'r2', 'b'])

    const copy = new ClipboardEvent('copy', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    })
    cell('r1', 'a').dispatchEvent(copy)
    expect(log).toContainEqual(['copy', 'r1', 'a'])
    expect(copy.clipboardData!.getData('text/plain').split('\n')).toHaveLength(
      2,
    )

    await userEvent.click(cell('r3', 'c'), { button: 'right' } as never)
    expect(log).toContainEqual(['contextmenu', 'r3', 'c'])

    // У ячейки и строки — только обработчики фокуса навигации ядра.
    const focusOnly = ['onBlur', 'onFocus']
    expect(reactHandlers(cell('r1', 'a')).sort()).toEqual(focusOnly)
    expect(
      reactHandlers(row('r1')).filter(name => !focusOnly.includes(name)),
    ).toEqual([])
  })
})
