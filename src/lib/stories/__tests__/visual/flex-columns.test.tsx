import { type ReactNode, useState } from 'react'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnPinning,
  columnSizing,
  columnVisibility,
  rowSelection,
} from '../../../plugins'
import type { ColumnFiltersState } from '../../../types'
import { nextFrame, waitForGrid } from './core-helpers'

// Флекс-колонки (ADR 0216): ширины — из раскладки шапки, тела и футера, а не из устройства среза.

type Row = { id: string; a: string; b: string; c: string }

const rowsOf = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    a: `A ${i}`,
    b: `B ${i}`,
    c: `C ${i}`,
  }))

const COLUMNS = ['a', 'b', 'c'].map(id => ({
  id,
  accessorKey: id,
  header: id.toUpperCase(),
  footer: id.toUpperCase(),
}))

interface GridProps {
  width?: number
  count?: number
  columns?: object[]
  defaultColumn?: { flex?: number; minSize?: number }
  plugins?: unknown[]
  loading?: boolean
  onTable?: (table: unknown) => void
  extra?: Record<string, unknown>
  children?: ReactNode
}

const Grid = ({
  width = 800,
  count = 10,
  columns = COLUMNS,
  defaultColumn = { flex: 1 },
  plugins = [columnSizing()],
  loading,
  onTable,
  extra,
}: GridProps) => {
  const table = useCreateTable({
    columns: columns as never,
    data: loading ? [] : rowsOf(count),
    loading: loading ? 'initial' : undefined,
    defaultColumn,
    getRowId: (row: Row) => row.id,
    plugins: plugins as never,
    enableFooter: true,
    ...extra,
  })
  onTable?.(table)
  return (
    <div style={{ width, height: 360 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const cellsOf = (selector: string, id: string) => [
  ...document.querySelectorAll<HTMLElement>(
    `${selector}[data-column-id="${id}"]`,
  ),
]
const head = (id: string) => cellsOf('.data-grid__head-cell', id)[0]!
const widthOf = (element: Element) => element.getBoundingClientRect().width
const headWidth = (id: string) => widthOf(head(id))
/** Сумма ширин ячеек шапки — ширина области без вертикальной полосы. */
const headSum = () =>
  [...document.querySelectorAll('.data-grid__head-cell')].reduce(
    (sum, cell) => sum + widthOf(cell),
    0,
  )

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Флекс-колонки (ADR 0216)', () => {
  test('FX2: defaultColumn: { flex: 1 } растягивает колонки данных; служебные колонки, группы шапки и скрытые колонки не флекс; закреплённые делят наравне', async () => {
    let table: any
    const screen = await render(
      <Grid
        plugins={[
          rowSelection(),
          columnSizing(),
          columnPinning(),
          columnVisibility(),
        ]}
        onTable={value => (table = value)}
      />,
    )
    await waitForGrid()
    await expect.poll(() => Math.round(headSum())).toBe(scroller().clientWidth)
    // Служебная колонка выбора — своей ширины, флекс её не трогает.
    const select = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id^="actionColumn"]',
    )!
    expect(widthOf(select)).toBeLessThan(60)
    const share = headWidth('a')
    expect(Math.abs(headWidth('b') - share)).toBeLessThanOrEqual(1)
    expect(Math.abs(headWidth('c') - share)).toBeLessThanOrEqual(1)

    // Закреплённая делит ширину наравне.
    table.setColumnPinning({ start: ['c'], end: [] })
    await nextFrame()
    await expect.poll(() => Math.round(headSum())).toBe(scroller().clientWidth)
    expect(Math.abs(headWidth('c') - headWidth('a'))).toBeLessThanOrEqual(1)

    // Скрытая не делит: две оставшиеся забирают её долю.
    table.setColumnVisibility({ b: false })
    await expect
      .poll(() => cellsOf('.data-grid__head-cell', 'b').length)
      .toBe(0)
    await expect.poll(() => headWidth('a')).toBeGreaterThan(share + 50)
    expect(Math.round(headSum())).toBe(scroller().clientWidth)

    table.setColumnVisibility({})
    await screen.unmount()

    // Группа шапки — сумма своих листьев; `flex` у группы не действует.
    await render(
      <Grid
        columns={[
          { id: 'g', header: 'G', flex: 5, columns: COLUMNS.slice(0, 2) },
          COLUMNS[2]!,
        ]}
      />,
    )
    await waitForGrid()
    await expect.poll(() => Math.round(headWidth('c'))).toBeGreaterThan(0)
    const leaves = Math.round(headWidth('a') + headWidth('b'))
    expect(Math.abs(Math.round(headWidth('g')) - leaves)).toBeLessThanOrEqual(1)
    expect(Math.abs(headWidth('a') - headWidth('c'))).toBeLessThanOrEqual(1)
  })

  test('FX3: протянутая флекс-колонка становится фиксированной, остальные флекс делят оставшееся; сброс ширины возвращает флекс; в onColumnSizingChange приходит только протянутая', async () => {
    const changes: Record<string, number>[] = []
    const Controlled = () => {
      const [sizing, setSizing] = useState<Record<string, number>>({})
      return (
        <Grid
          extra={{
            state: { columnSizing: sizing },
            handlers: {
              onColumnSizingChange: (updater: unknown) =>
                setSizing(old => {
                  const next =
                    typeof updater === 'function'
                      ? (updater as (o: object) => Record<string, number>)(old)
                      : (updater as Record<string, number>)
                  changes.push(next)
                  return next
                }),
            },
          }}
        />
      )
    }
    await render(<Controlled />)
    await waitForGrid()
    const before = headWidth('b')
    // Клавиши на разделителе — настоящий ввод пользователя (ADR 0031, KB2).
    const separator =
      head('a').querySelector<HTMLElement>('[role="separator"]')!
    separator.focus()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await expect.poll(() => headWidth('b')).toBeLessThan(before)
    const resized = headWidth('a')
    expect(Math.round(headSum())).toBe(scroller().clientWidth)
    expect(Object.keys(changes.at(-1)!)).toEqual(['a'])

    // Окно уже: фиксированная колонка своей ширины, флекс-колонки — сузились.
    await userEvent.keyboard('{Home}')
    await expect.poll(() => Math.round(headWidth('b'))).toBe(Math.round(before))
    expect(headWidth('a')).not.toBe(resized)
    expect(changes.at(-1)).toEqual({})
  })

  test('FX4: сумма минимумов шире области — флекс-колонки на minSize, таблица прокручивается по горизонтали', async () => {
    await render(
      <Grid
        width={300}
        defaultColumn={{ flex: 1, minSize: 160 }}
        // Флекс не учитывает size: без флекса колонки были бы по 400.
        columns={COLUMNS.map(column => ({ ...column, size: 400 }))}
      />,
    )
    await waitForGrid()
    await expect.poll(() => Math.round(headWidth('a'))).toBe(160)
    expect(Math.round(headWidth('c'))).toBe(160)
    expect(scroller().scrollWidth).toBeGreaterThan(scroller().clientWidth)
  })

  test('FX5: изменение доступной ширины пересчитывает флекс-ширины без ошибки петли ResizeObserver; шапка, тело и футер совпадают, горизонтальной полосы нет', async () => {
    const errors = vi.spyOn(console, 'error')
    const loop: string[] = []
    const onError = (event: ErrorEvent) => loop.push(event.message)
    window.addEventListener('error', onError)
    const screen = await render(<Grid width={800} count={3} />)
    await waitForGrid()
    const without = scroller().clientWidth
    await expect.poll(() => Math.round(headSum())).toBe(without)

    // Строк стало больше высоты — появилась вертикальная полоса.
    await screen.rerender(<Grid width={800} count={200} />)
    await expect.poll(() => Math.round(headSum())).toBe(scroller().clientWidth)

    // Контейнер уже.
    await screen.rerender(<Grid width={500} count={200} />)
    await expect.poll(() => Math.round(headSum())).toBe(scroller().clientWidth)
    for (const id of ['a', 'b', 'c']) {
      const width = Math.round(headWidth(id))
      const body = cellsOf('.data-grid__body-cell', id)[0]!
      const foot = cellsOf('.data-grid__footer-cell', id)[0]!
      expect(Math.round(widthOf(body)), id).toBe(width)
      expect(Math.round(widthOf(foot)), id).toBe(width)
    }
    expect(scroller().scrollWidth).toBe(scroller().clientWidth)
    await nextFrame()
    window.removeEventListener('error', onError)
    expect(loop.filter(text => text.includes('ResizeObserver'))).toEqual([])
    expect(
      errors.mock.calls.filter(call =>
        String(call[0]).includes('ResizeObserver'),
      ),
    ).toEqual([])
  })

  test('FX11: фильтрация и сброс сохраняют доступную ширину и ширину каждой флекс-колонки', async ({
    skip,
  }) => {
    if (!CSS.supports('scrollbar-gutter', 'stable')) skip()

    let table!: { setColumnFilters: (filters: ColumnFiltersState) => void }
    await render(
      <Grid
        count={200}
        plugins={[columnSizing(), columnFiltering({ debounceMs: 0 })]}
        onTable={value => (table = value as typeof table)}
      />,
    )
    await waitForGrid()
    const container = scroller()
    const hasVerticalOverflow = () =>
      container.scrollHeight > container.clientHeight
    const widths = () => COLUMNS.map(({ id }) => headWidth(id))
    await expect.poll(hasVerticalOverflow).toBe(true)
    await expect.poll(headSum).toBe(container.clientWidth)

    const initialWidth = container.clientWidth
    const initialColumns = widths()
    table.setColumnFilters([
      { id: 'a', value: { operator: 'equals', value: 'A 0' } },
    ])
    await expect.poll(hasVerticalOverflow).toBe(false)
    expect(getComputedStyle(container).scrollbarGutter).toBe('stable')
    expect(container.clientWidth).toBe(initialWidth)
    expect(widths()).toEqual(initialColumns)
    expect(container.scrollWidth).toBe(initialWidth)

    table.setColumnFilters([])
    await expect.poll(hasVerticalOverflow).toBe(true)
    expect(container.clientWidth).toBe(initialWidth)
    expect(widths()).toEqual(initialColumns)
  })

  test('FX6: ширины целые, их сумма равна ширине области; заполнитель справа нулевой ширины', async () => {
    await render(
      <Grid
        width={641}
        columns={COLUMNS.map((column, index) => ({
          ...column,
          flex: index + 1,
        }))}
      />,
    )
    await waitForGrid()
    await expect.poll(() => Math.round(headSum())).toBe(scroller().clientWidth)
    for (const id of ['a', 'b', 'c'])
      expect(Number.isInteger(headWidth(id)), id).toBe(true)
    // Веса 1:2:3 — доли растут с весом.
    expect(headWidth('b')).toBeGreaterThan(headWidth('a'))
    expect(headWidth('c')).toBeGreaterThan(headWidth('b'))
    // Заполнитель справа — то, что осталось от строки за последней колонкой.
    const row = document.querySelector<HTMLElement>('.data-grid__body-row')!
    const last = cellsOf('.data-grid__body-cell', 'c')[0]!
    expect(
      Math.round(
        row.getBoundingClientRect().right - last.getBoundingClientRect().right,
      ),
    ).toBeLessThanOrEqual(0)
  })

  test('FX7: первый кадр — с флекс-ширинами: ширина колонки до первой отрисовки не равна size, если флекс-ширина другая', async () => {
    const seen: number[] = []
    const Probe = () => {
      // Первый кадр: замер в rAF, запланированном до первой отрисовки.
      requestAnimationFrame(() => {
        const cell = document.querySelector(
          '.data-grid__head-cell[data-column-id="a"]',
        )
        if (cell && seen.length === 0) seen.push(widthOf(cell))
      })
      return null
    }
    await render(
      <>
        <Grid columns={COLUMNS.map(column => ({ ...column, size: 150 }))} />
        <Probe />
      </>,
    )
    await waitForGrid()
    await expect.poll(() => seen.length).toBe(1)
    expect(Math.round(seen[0]!)).not.toBe(150)
    expect(Math.round(seen[0]!)).toBe(Math.round(headWidth('a')))
  })

  test('FX8: column.getSize(), виртуализация колонок и выгрузка видят флекс-ширину; в срез приложения columnSizing она не попадает', async () => {
    let table: any
    const onColumnSizingChange = vi.fn()
    await render(
      <Grid
        onTable={value => (table = value)}
        extra={{ handlers: { onColumnSizingChange } }}
      />,
    )
    await waitForGrid()
    await expect.poll(() => Math.round(headSum())).toBe(scroller().clientWidth)
    const a = table.getColumn('a')
    expect(Math.round(a.getSize())).toBe(Math.round(headWidth('a')))
    // Начало второй колонки в разметке — по флекс-ширине первой.
    expect(
      Math.round(
        head('b').getBoundingClientRect().left -
          head('a').getBoundingClientRect().left,
      ),
    ).toBe(Math.round(a.getSize()))
    expect(onColumnSizingChange).not.toHaveBeenCalled()
  })

  test('FX9: скелет первой загрузки рисует колонки флекс-ширинами', async () => {
    const screen = await render(<Grid loading />)
    await expect
      .poll(
        () =>
          document.querySelectorAll('.data-grid__body-row--skeleton').length,
      )
      .toBeGreaterThan(0)
    await expect.poll(() => Math.round(headSum())).toBe(scroller().clientWidth)
    const share = headWidth('a')
    expect(Math.abs(headWidth('c') - share)).toBeLessThanOrEqual(1)
    // Ячейка скелета под колонкой «a» — по месту: левый край тот же, что у заголовка.
    const left = Math.round(head('a').getBoundingClientRect().left)
    const skeletonCell = [
      ...document.querySelectorAll<HTMLElement>(
        '.data-grid__body-row--skeleton .data-grid__body-cell--skeleton',
      ),
    ].find(cell => Math.round(cell.getBoundingClientRect().left) === left)!
    expect(skeletonCell).toBeTruthy()
    expect(Math.round(widthOf(skeletonCell))).toBe(Math.round(share))
    await screen.unmount()
  })
})
