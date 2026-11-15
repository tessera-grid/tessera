/**
 * Итоги колонок в футере настоящим рендером (ADR 0184; CT2, CT3, CT10, CT13): текст по типу
 * колонки, свой `footer` главнее итога в клиентском режиме и в серверной модели строк,
 * доступность, пересчёт после правки.
 */
import { useState } from 'react'
import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnTotals,
  rowExpanding,
  serverRowModel,
} from '../../../plugins'
import { humanClick } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'

interface Item {
  id: string
  name: string
  amount: number
  visits: number
  rank: number
  price: number
  subRows?: Item[]
}

const ROWS: Item[] = [
  { id: 'r1', name: 'Ann', amount: 1000, visits: 3, rank: 1, price: 2 },
  { id: 'r2', name: 'Bob', amount: 2500, visits: 5, rank: 2, price: 4 },
  { id: 'r3', name: 'Cy', amount: 500, visits: 1, rank: 3, price: 9 },
]

interface GridTable {
  getColumnTotal: (columnId: string) => unknown
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    dataType: 'money',
    aggregationFn: 'sum',
  },
  // Определение агрегата TanStack вместо имени из набора.
  {
    id: 'visits',
    accessorKey: 'visits',
    header: 'Visits',
    dataType: 'number',
    aggregationFn: { aggregate: () => 42 },
  },
  // Числовая колонка без явного агрегата — как id: сумма в ней бессмысленна.
  {
    id: 'rank',
    accessorKey: 'rank',
    header: 'Rank',
    dataType: 'number',
    aggregationFn: 'auto',
  },
  {
    id: 'price',
    accessorKey: 'price',
    header: 'Price',
    dataType: 'number',
    aggregationFn: 'extent',
  },
]

const DATA_TYPES = {
  money: {
    extends: 'number',
    format: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
  },
}

const Grid = ({
  columns = COLUMNS,
  locale,
  plugins = [columnTotals()],
  data = ROWS,
  ...rest
}: {
  columns?: readonly object[]
  locale?: string
  plugins?: readonly unknown[]
  data?: Item[]
} & Record<string, unknown>) => {
  const table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Item) => row.id,
    plugins: plugins as never,
    locale,
    dataTypes: DATA_TYPES,
    ...rest,
  } as never)
  return (
    <div style={{ width: 900, height: 300 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const footerOf = (id: string) =>
  document
    .querySelector(`.data-grid__footer-cell[data-column-id="${id}"]`)
    ?.textContent?.trim() ?? null

const waitForFooter = () =>
  expect.poll(() => document.querySelector('.data-grid__footer')).not.toBeNull()

const NO_ROWS: Item[] = []

describe('итоги колонок в футере (ADR 0184)', () => {
  test("CT2: колонка с aggregationFn строкой или определением { aggregate } и без footer показывает итог текстом по типу, итог-массив — через запятую; колонка без aggregationFn и с 'auto' — пустая ячейка", async () => {
    const screen = await render(<Grid locale="en-US" />)
    await waitForFooter()
    await expect.poll(() => footerOf('amount')).toBe('$4,000')
    expect(footerOf('visits')).toBe('42')
    expect(footerOf('price')).toBe('2, 9')
    expect(footerOf('rank')).toBe('')
    expect(footerOf('name')).toBe('')
    await screen.unmount()
  })

  test('CT3: свой footer главнее итога и читает значение через table.getColumnTotal(id) — один код в клиентском режиме и в серверной модели строк', async () => {
    const columns = COLUMNS.map(column =>
      column.id === 'amount'
        ? {
            ...column,
            footer: ({ table }: { table: GridTable }) =>
              `Sum: ${String(table.getColumnTotal('amount'))}`,
          }
        : column,
    )
    const client = await render(<Grid columns={columns} />)
    await waitForFooter()
    await expect.poll(() => footerOf('amount')).toBe('Sum: 4000')
    await client.unmount()

    const getRows = ({ start, end }: { start: number; end: number }) =>
      Promise.resolve({
        rows: ROWS.slice(start, end),
        rowCount: ROWS.length,
        totals: { amount: 777 },
      })
    const server = await render(
      <Grid
        columns={columns}
        data={NO_ROWS}
        plugins={[columnTotals(), serverRowModel({ getRows } as never)]}
      />,
    )
    await waitForFooter()
    await expect.poll(() => footerOf('amount')).toBe('Sum: 777')
    await server.unmount()
  })

  test('CT13: правка ячейки, записанная в данные, пересчитывает итог её колонки в футере', async () => {
    const Editable = () => {
      const [data, setData] = useState(ROWS)
      return (
        <Grid
          locale="en-US"
          data={data}
          plugins={[
            columnTotals(),
            cellEditing({
              onCellEdit: ({ rowId, columnId, value }) =>
                setData(rows =>
                  rows.map(row =>
                    row.id === rowId ? { ...row, [columnId]: value } : row,
                  ),
                ),
            }),
          ]}
        />
      )
    }
    const screen = await render(<Editable />)
    await waitForFooter()
    await expect.poll(() => footerOf('amount')).toBe('$4,000')
    const cell = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-row-id="r1"] .data-grid__body-cell[data-column-id="amount"]',
      )!
    await userEvent.hover(cell())
    // Кнопка проявляется переходом: клик Playwright ждёт, пока она встанет.
    await expect
      .poll(
        () => getComputedStyle(cell().querySelector('.cell__button')!).opacity,
      )
      .toBe('1')
    await humanClick(cell().querySelector<HTMLElement>('.cell__button button')!)
    await expect.poll(() => cell().querySelector('input')).not.toBeNull()
    await userEvent.fill(cell().querySelector('input')!, '3000')
    await userEvent.keyboard('{Enter}')
    // 3000 + 2500 + 500.
    await expect.poll(() => footerOf('amount')).toBe('$6,000')
    await screen.unmount()
  })

  test('CT10: футер с итогами — axe с color-contrast в обеих темах и ролях table, grid, treegrid', async () => {
    const options = {
      ...AXE_OPTIONS,
      rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
    }
    const cases: [string, Record<string, unknown>, string][] = [
      ['table', { enableKeyboardNavigation: false }, 'table'],
      ['grid', { enableKeyboardNavigation: true }, 'grid'],
      [
        'treegrid',
        {
          enableKeyboardNavigation: true,
          plugins: [columnTotals(), rowExpanding()],
          data: [{ ...ROWS[0], subRows: [ROWS[1]] }],
          getSubRows: (row: Item) => row.subRows,
        },
        'treegrid',
      ],
    ]
    for (const [label, props, role] of cases) {
      // eslint-disable-next-line no-await-in-loop
      const screen = await render(<Grid {...props} />)
      // eslint-disable-next-line no-await-in-loop
      await waitForFooter()
      // eslint-disable-next-line no-await-in-loop
      await expect
        .poll(() => document.querySelector(`[role="${role}"]`))
        .not.toBeNull()
      // eslint-disable-next-line no-await-in-loop
      await inBothThemes(async () => {
        expect(
          (await axe.run(document.querySelector('.data-grid-theme')!, options))
            .violations,
          label,
        ).toEqual([])
      })
      // eslint-disable-next-line no-await-in-loop
      await screen.unmount()
    }
  })
})
