/**
 * Вспышка итога колонки в футере (ADR 0221, §9; VC21–VC22, VC24): смена значений строк и режима подсчёта вспыхивает,
 * смена набора строк, первое появление и невидимая строка итогов — нет.
 */
import { useState } from 'react'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../ui/theme/theme.css'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnTotals,
  pagination,
  quickSearch,
  serverRowModel,
  valueChangeFlash,
} from '../../../plugins'
import { humanClick } from '../helpers'

interface Item {
  id: string
  name: string
  amount: number
}

const rows = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: i % 2 ? `Odd ${i}` : `Even ${i}`,
    amount: 10,
  }))

const amountColumn = (extra: Record<string, unknown> = {}) => ({
  id: 'amount',
  accessorKey: 'amount',
  header: 'Amount',
  dataType: 'number',
  aggregationFn: 'sum',
  enableGlobalFilter: false,
  ...extra,
})
const nameColumn = { id: 'name', accessorKey: 'name', header: 'Name' }

const footer = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__footer-cell[data-column-id="amount"]',
  )
const footerText = () => footer()?.textContent?.trim()
const footerFlash = () => footer()?.getAttribute('data-flash') ?? null
const footerArrow = () =>
  footer()
    ?.querySelector('[data-flash-direction]')
    ?.getAttribute('data-flash-direction') ?? null
const nextFrame = () => new Promise(requestAnimationFrame)

/** Ни в одном кадре за `ms` у итога нет вспышки. */
const neverFlashes = async (ms: number) => {
  const until = performance.now() + ms
  while (performance.now() < until) {
    expect(footerFlash()).toBeNull()
    // eslint-disable-next-line no-await-in-loop
    await nextFrame()
  }
}
/** Прежняя вспышка догорела. */
const flashGone = () => expect.poll(footerFlash, { timeout: 5000 }).toBeNull()

let setData!: (change: (items: Item[]) => Item[]) => void
let setColumns!: (columns: object[]) => void
let setTotals!: (totals: Record<string, unknown> | undefined) => void

const Grid = ({
  count = 5,
  plugins,
  columns: initialColumns = [nameColumn, amountColumn()],
  ...options
}: {
  count?: number
  plugins: (totals: Record<string, unknown> | undefined) => unknown[]
  columns?: object[]
} & Record<string, unknown>) => {
  const [data, set] = useState(() => rows(count))
  const [columns, setCols] = useState(initialColumns)
  const [totals, setT] = useState<Record<string, unknown>>()
  setData = set
  setColumns = setCols
  setTotals = setT
  const table = useCreateTable({
    columns: columns as never,
    data,
    getRowId: (row: Item) => row.id,
    locale: 'en-US',
    plugins: plugins(totals) as never,
    ...options,
  } as never)
  return (
    <div style={{ width: 600, height: 320 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const bump = (id: string, amount: number) =>
  setData(items =>
    items.map(item => (item.id === id ? { ...item, amount } : item)),
  )

describe('вспышка итога колонки в футере (ADR 0221, §9)', () => {
  test("VC21: итог вспыхивает при смене значений строк — новым data и своей правкой человека; тон смены, при 'direction' — рост и падение со стрелкой; колонка с changeFlash: false и таблица без плагина — без вспышки", async () => {
    const editable = (totals: Record<string, unknown> | undefined) => [
      columnTotals({ totals }),
      valueChangeFlash({ columnDefault: 'direction' }),
      cellEditing({
        onCellEdit: ({ rowId, value }) => bump(rowId, Number(value)),
      }),
    ]
    let screen = await render(<Grid plugins={editable} />)
    await expect.poll(footerText).toBe('50')

    bump('r1', 40)
    await expect.poll(footerFlash).toBe('up')
    expect(footerArrow()).toBe('up')
    await flashGone()
    bump('r1', 0)
    await expect.poll(footerFlash).toBe('down')
    expect(footerArrow()).toBe('down')
    await flashGone()

    // Своя правка человека: ячейка не вспыхивает, итог — вспыхивает.
    const cell = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-row-id="r2"] .data-grid__body-cell[data-column-id="amount"]',
      )!
    await userEvent.hover(cell())
    await expect
      .poll(
        () => getComputedStyle(cell().querySelector('.cell__button')!).opacity,
      )
      .toBe('1')
    await humanClick(cell().querySelector<HTMLElement>('.cell__button button')!)
    await expect.poll(() => cell().querySelector('input')).not.toBeNull()
    await userEvent.fill(cell().querySelector('input')!, '100')
    await userEvent.keyboard('{Enter}')
    await expect.poll(footerText).toBe('130')
    await expect.poll(footerFlash).toBe('up')
    await screen.unmount()

    // Без направления — тон смены без стрелки.
    screen = await render(
      <Grid
        plugins={() => [
          columnTotals(),
          valueChangeFlash({ columnDefault: true }),
        ]}
      />,
    )
    await expect.poll(footerText).toBe('50')
    bump('r1', 40)
    await expect.poll(footerFlash).toBe('changed')
    expect(footerArrow()).toBeNull()
    await screen.unmount()

    // Колонка без вспышки и таблица без плагина.
    for (const plugins of [
      () => [columnTotals(), valueChangeFlash()],
      () => [columnTotals()],
    ]) {
      const columns =
        plugins().length === 2
          ? [nameColumn, amountColumn({ changeFlash: false })]
          : undefined
      // eslint-disable-next-line no-await-in-loop
      screen = await render(<Grid plugins={plugins} columns={columns} />)
      // eslint-disable-next-line no-await-in-loop
      await expect.poll(footerText).toBe('50')
      bump('r1', 40)
      // eslint-disable-next-line no-await-in-loop
      await expect.poll(footerText).toBe('80')
      // eslint-disable-next-line no-await-in-loop
      await neverFlashes(300)
      // eslint-disable-next-line no-await-in-loop
      await screen.unmount()
    }
  })

  test('VC22: итог не вспыхивает при смене набора строк — поиск и смена агрегата колонки, — при первом появлении итога и в строке итогов за краем области, в том числе после прокрутки к ней', async () => {
    let screen = await render(
      <Grid
        plugins={() => [
          columnTotals(),
          valueChangeFlash(),
          quickSearch({ debounceMs: 0 }),
        ]}
      />,
    )
    await expect.poll(footerText).toBe('50')
    await expect
      .poll(() => document.querySelector('[data-testid="quick-search"]'))
      .not.toBeNull()
    await userEvent.fill(
      document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')!,
      'Odd',
    )
    await expect.poll(footerText).toBe('20')
    await neverFlashes(300)

    setColumns([nameColumn, amountColumn({ aggregationFn: 'count' })])
    await expect.poll(footerText).toBe('2')
    await neverFlashes(300)
    await screen.unmount()

    // Первое появление итога: страница с сервера, итог приходит от приложения.
    screen = await render(
      <Grid
        plugins={totals => [
          columnTotals({ totals }),
          valueChangeFlash(),
          pagination({ initialPageSize: 5 }),
        ]}
        dataMode={{ pagination: 'server' }}
        rowCount={100}
      />,
    )
    await expect.poll(footerText).toBe('')
    setTotals({ amount: 1000 })
    await expect.poll(footerText).toBe('1000')
    await neverFlashes(300)
    // Сторож жив: следующий итог — смена значения.
    setTotals({ amount: 1200 })
    await expect.poll(footerFlash).toBe('changed')
    await screen.unmount()

    // Строка итогов за последней строкой и за краем области.
    screen = await render(
      <Grid
        count={100}
        plugins={() => [columnTotals(), valueChangeFlash()]}
        footerPosition="inline"
      />,
    )
    await expect.poll(footerText).toBe('1000')
    bump('r1', 40)
    await expect.poll(footerText).toBe('1030')
    await neverFlashes(300)
    const scroller = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    scroller.scrollTop = scroller.scrollHeight
    await expect
      .poll(() => {
        const box = footer()!.getBoundingClientRect()
        return box.bottom <= scroller.getBoundingClientRect().bottom + 1
      })
      .toBe(true)
    await neverFlashes(300)
    await screen.unmount()
  })

  test("VC24: смена режима aggregationScope колонки вспыхивает её итогом — на клиенте и в серверной модели, где смена режима начинает новую выборку; при 'direction' — тон роста или падения со стрелкой", async () => {
    const scoped = (scope: 'top' | 'all') => [
      nameColumn,
      amountColumn({ aggregationScope: scope }),
    ]
    // Клиент: у отдела свои продажи, у сотрудника — свои.
    let screen = await render(
      <Grid
        plugins={() => [
          columnTotals(),
          valueChangeFlash({ columnDefault: 'direction' }),
        ]}
        columns={scoped('top')}
        getSubRows={(row: Item & { subRows?: Item[] }) => row.subRows}
      />,
    )
    setData(() => [
      {
        id: 'a',
        name: 'A',
        amount: 10,
        subRows: [{ id: 'a1', name: 'A1', amount: 5 }],
      } as Item,
    ])
    await expect.poll(footerText).toBe('10')
    await flashGone()
    setColumns(scoped('all'))
    await expect.poll(footerText).toBe('15')
    await expect.poll(footerFlash).toBe('up')
    expect(footerArrow()).toBe('up')
    await flashGone()
    setColumns(scoped('top'))
    await expect.poll(footerText).toBe('10')
    await expect.poll(footerFlash).toBe('down')
    await screen.unmount()

    // Серверная модель: новый режим уходит в запрос новой выборки, итог приходит с сервера.
    const getRows = (request: { aggregationScopes: Record<string, string> }) =>
      Promise.resolve({
        rows: rows(2),
        rowCount: 2,
        totals: {
          amount: request.aggregationScopes.amount === 'all' ? 40 : 20,
        },
      })
    screen = await render(
      <Grid
        plugins={() => [
          serverRowModel({ getRows } as never),
          columnTotals(),
          valueChangeFlash({ columnDefault: 'direction' }),
        ]}
        columns={scoped('top')}
      />,
    )
    await expect.poll(footerText).toBe('20')
    await flashGone()
    setColumns(scoped('all'))
    await expect.poll(footerText).toBe('40')
    await expect.poll(footerFlash).toBe('up')
    expect(footerArrow()).toBe('up')
    await screen.unmount()
  })
})
