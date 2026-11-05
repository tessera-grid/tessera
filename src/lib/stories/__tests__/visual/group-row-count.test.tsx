/**
 * Подпись числа строк группы настоящим рендером (ADR 0184; GC1, GC4–GC6): клиентская группировка
 * и поиск, отключение на лету, узкая ячейка, серверные группы и липкие строки.
 */
import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  quickSearch,
  rowExpanding,
  rowGrouping,
  serverRowModel,
} from '../../../plugins'

interface Item {
  id: string
  city: string
  name: string
}

const CITY = 'Saint Petersburg and the surrounding region'

const ROWS: Item[] = Array.from({ length: 200 }, (_, index) => ({
  id: `r${index}`,
  city: index < 3 ? CITY : 'Rome',
  name: `Name ${index}`,
}))

const COLUMNS = [
  { id: 'city', accessorKey: 'city', header: 'City', size: 260 },
  { id: 'name', accessorKey: 'name', header: 'Name', size: 200 },
]

const Grid = ({
  columns = COLUMNS,
  plugins,
  width = 700,
  ...rest
}: {
  columns?: readonly object[]
  plugins: readonly unknown[]
  width?: number
} & Record<string, unknown>) => {
  const table = useCreateTable({
    columns: columns as never,
    data: ROWS,
    getRowId: (row: Item) => row.id,
    plugins: plugins as never,
    ...rest,
  } as never)
  return (
    <div style={{ width, height: 320 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const counts = () =>
  [...document.querySelectorAll('[data-group-count]')].map(
    element => element.textContent?.trim() ?? '',
  )

const waitForGroups = () =>
  expect.poll(() => document.querySelector('[data-group-count]')).not.toBeNull()

describe('подпись числа строк группы (ADR 0184)', () => {
  test('GC1: строка группы показывает число строк данных в ней, на клиенте — после фильтров и поиска', async () => {
    const screen = await render(
      <Grid
        plugins={[
          rowGrouping({ initialGrouping: ['city'] }),
          rowExpanding(),
          quickSearch({ debounceMs: 0 }),
        ]}
      />,
    )
    await waitForGroups()
    await expect.poll(counts).toEqual(['(3)', '(197)'])

    await expect
      .poll(() => document.querySelector('[data-testid="quick-search"]'))
      .not.toBeNull()
    await userEvent.type(
      document.querySelector<HTMLElement>('[data-testid="quick-search"]')!,
      'Name 1',
    )
    await expect.poll(counts).toEqual(['(1)', '(110)'])
    await screen.unmount()
  })

  test('GC4: rowGrouping({ groupRowCount: false }) убирает подпись в обоих режимах; смена аргумента действует на лету', async () => {
    let toggle!: (next: boolean) => void
    const Host = () => {
      const [shown, setShown] = useState(true)
      toggle = setShown
      return (
        <Grid
          plugins={[
            rowGrouping({
              initialGrouping: ['city'],
              groupRowCount: shown,
            }),
            rowExpanding(),
          ]}
        />
      )
    }
    const client = await render(<Host />)
    await waitForGroups()
    toggle(false)
    await expect.poll(counts).toEqual([])
    toggle(true)
    await expect.poll(counts).toEqual(['(3)', '(197)'])
    await client.unmount()

    const server = await render(
      <Grid
        data={[]}
        rowCount={1}
        plugins={[
          rowGrouping({ initialGrouping: ['city'], groupRowCount: false }),
          rowExpanding(),
          serverRowModel({
            getRows: () =>
              Promise.resolve({
                rows: [{ id: '', city: 'Rome', name: '', rows: 9 }],
                rowCount: 1,
              }),
            getGroupChildCount: (row: { rows: number }) => row.rows,
          } as never),
        ]}
      />,
    )
    await expect
      .poll(() => document.querySelector('[data-group-row="true"]'))
      .not.toBeNull()
    expect(counts()).toEqual([])
    await server.unmount()
  })

  test('GC5: в узкой ячейке … сокращает значение, а не число; число не обрезается и при своём свойстве ячейки cell', async () => {
    const check = async (columns: readonly object[]) => {
      const screen = await render(
        <Grid
          columns={columns}
          plugins={[rowGrouping({ initialGrouping: ['city'] }), rowExpanding()]}
        />,
      )
      await waitForGroups()
      const count = document.querySelector<HTMLElement>('[data-group-count]')!
      const value =
        count.parentElement!.querySelector<HTMLElement>('[data-group-value]')!
      const cell = count.closest<HTMLElement>('.data-grid__body-cell')!
      await expect.poll(() => count.textContent?.trim()).toBe('(3)')
      expect(value.scrollWidth).toBeGreaterThan(value.clientWidth)
      expect(count.scrollWidth).toBeLessThanOrEqual(count.clientWidth + 1)
      expect(count.getBoundingClientRect().right).toBeLessThanOrEqual(
        cell.getBoundingClientRect().right,
      )
      await screen.unmount()
    }
    const narrow = COLUMNS.map(column =>
      column.id === 'city' ? { ...column, size: 150 } : column,
    )
    await check(narrow)
    await check(
      narrow.map(column =>
        column.id === 'city'
          ? {
              ...column,
              cell: ({ getValue }: { getValue: () => string }) => (
                <b>{getValue()}</b>
              ),
            }
          : column,
      ),
    )
  })

  test('GC6: подпись видна в клиентских и серверных группах и в липких строках, скринридер читает значение и число', async () => {
    const client = await render(
      <Grid
        plugins={[
          rowGrouping({ initialGrouping: ['city'], stickyRows: true }),
          rowExpanding({ initialExpanded: true }),
        ]}
      />,
    )
    await waitForGroups()
    const group = document.querySelector<HTMLElement>(
      '[data-group-row="true"]',
    )!
    expect(group.textContent).toContain(`${CITY} (3)`)
    document.querySelector<HTMLElement>('.data-grid__container')!.scrollTop =
      600
    await expect
      .poll(
        () =>
          document.querySelector('[data-sticky-rows] [data-row-id]')
            ?.textContent ?? '',
      )
      .toContain('(197)')
    await client.unmount()

    const server = await render(
      <Grid
        data={[]}
        rowCount={1}
        plugins={[
          rowGrouping({ initialGrouping: ['city'] }),
          rowExpanding(),
          serverRowModel({
            getRows: () =>
              Promise.resolve({
                rows: [{ id: '', city: 'Rome', name: '', rows: 9 }],
                rowCount: 1,
              }),
            getGroupRowCount: (row: { rows: number }) => row.rows,
          } as never),
        ]}
      />,
    )
    await waitForGroups()
    await expect.poll(counts).toEqual(['(9)'])
    expect(
      document.querySelector('[data-group-row="true"]')?.textContent,
    ).toContain('Rome (9)')
    await server.unmount()
  })
})
