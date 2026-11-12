import { useState } from 'react'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { columnSizing, headerActionMenu, rowSelection } from '../../../plugins'
import { humanClick, revealCellButtons } from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'

// Автоподбор ширины по содержимому (ADR 0217): вид — по раскладке и обрезке подписей.

type Row = { id: string; a: string; b: string }

const LONG = 'Annabelle Featherstonehaugh-Montgomery'

const rowsOf = (count: number, long = LONG): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    a: i === 2 ? long : `A ${i}`,
    b: `B ${i}`,
  }))

const columnsOf = (count = 2, size = 100) =>
  Array.from({ length: count }, (_, i) => ({
    id: i === 0 ? 'a' : i === 1 ? 'b' : `c${i}`,
    accessorKey: i === 0 ? 'a' : 'b',
    header: i === 0 ? 'A' : i === 1 ? 'B' : `Column ${i}`,
    size,
  }))

interface GridProps {
  width?: number
  columns?: object[]
  data?: Row[]
  plugins?: unknown[]
  defaultColumn?: { flex?: number }
  onTable?: (table: unknown) => void
  extra?: Record<string, unknown>
}

const Grid = ({
  width = 900,
  columns = columnsOf(),
  data = rowsOf(10),
  plugins = [columnSizing(), headerActionMenu()],
  defaultColumn,
  onTable,
  extra,
}: GridProps) => {
  const table = useCreateTable({
    columns: columns as never,
    data,
    defaultColumn,
    getRowId: (row: Row) => row.id,
    plugins: plugins as never,
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
const head = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const widthOf = (id: string) =>
  Math.round(head(id).getBoundingClientRect().width)
const titlesOf = (id: string) => [
  ...document.querySelectorAll<HTMLElement>(
    `.data-grid__body-cell[data-column-id="${id}"] .data-grid__cell-wrapper-title`,
  ),
]
/** Подпись не обрезана: текст помещается в свой блок. */
const fits = (id: string) =>
  titlesOf(id).every(title => title.scrollWidth <= title.clientWidth)
const grip = (id: string) =>
  head(id).querySelector<HTMLElement>('.resize__handler--column')!
const menuItem = (actionId: string) =>
  document.querySelector<HTMLElement>(
    `[role="menuitem"][data-action-id="${actionId}"]`,
  )
const kebab = (id: string) =>
  head(id).querySelector<HTMLElement>('[data-action-menu]')!

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Автоподбор ширины (ADR 0217)', () => {
  test('AZ1: подогнанная ширина — наибольшая из заголовка с кнопками и ячеек строк окна: подпись целиком без многоточия; в пределах minSize/maxSize', async () => {
    let table: any
    await render(
      <Grid
        columns={[
          ...columnsOf(),
          {
            id: 'capped',
            accessorKey: 'a',
            header: 'Capped',
            size: 80,
            maxSize: 140,
          },
        ]}
        onTable={value => (table = value)}
      />,
    )
    await waitForGrid()
    expect(fits('a')).toBe(false)
    await table.autosizeColumns()
    await expect.poll(() => fits('a')).toBe(true)
    // Ширина — по самому длинному значению, а не больше: на пиксель уже — снова обрезано.
    expect(widthOf('a')).toBeGreaterThan(200)
    expect(widthOf('a')).toBeLessThan(400)
    // Колонка с пределом — не шире maxSize.
    expect(widthOf('capped')).toBe(140)
  })

  test('AZ2: двойной клик по грипу закрывает меню ручки и подгоняет колонку', async () => {
    await render(<Grid />)
    await waitForGrid()
    await revealCellButtons(head('a'))
    await userEvent.dblClick(grip('a'))
    await expect.poll(() => fits('a')).toBe(true)
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()
    expect(widthOf('b')).toBe(100)
  })

  test('AZ3: пункты «Подогнать ширину» и «Подогнать все колонки» — в меню ручки грипа и в кебабе заголовка, с клавиатуры', async () => {
    await render(<Grid />)
    await waitForGrid()
    // Меню ручки грипа: оба пункта.
    await revealCellButtons(head('b'))
    await humanClick(grip('b'))
    await expect
      .poll(() => document.querySelector('[role="menu"]')?.textContent ?? '')
      .toContain('Autosize all columns')
    expect(document.querySelector('[role="menu"]')!.textContent).toContain(
      'Autosize column',
    )
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull()

    // Кебаб — с клавиатуры: пункт «Подогнать все колонки».
    await revealCellButtons(head('a'))
    kebab('a').focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => menuItem('columnSizing.autosizeAll')).not.toBeNull()
    expect(menuItem('columnSizing.autosize')).not.toBeNull()
    for (
      let i = 0;
      i < 10 && document.activeElement !== menuItem('columnSizing.autosizeAll');
      i++
    )
      await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => fits('a')).toBe(true)
  })

  test('AZ4: table.autosizeColumns(ids?) подгоняет названные или все колонки данных, промис — true; служебные не подгоняются', async () => {
    let table: any
    await render(
      <Grid
        plugins={[rowSelection(), columnSizing(), headerActionMenu()]}
        columns={columnsOf(3, 60)}
        onTable={value => (table = value)}
      />,
    )
    await waitForGrid()
    const select = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id^="actionColumn"]',
    )!
    const selectWidth = select.getBoundingClientRect().width
    expect(await table.autosizeColumns(['c2'])).toBe(true)
    await expect.poll(() => widthOf('c2')).not.toBe(60)
    expect(widthOf('a')).toBe(60)
    expect(await table.autosizeColumns()).toBe(true)
    await expect.poll(() => fits('a')).toBe(true)
    expect(select.getBoundingClientRect().width).toBe(selectWidth)
    // Только служебная — подгонять нечего.
    expect(
      await table.autosizeColumns([select.getAttribute('data-column-id')]),
    ).toBe(false)
  })

  test('AZ5: autosizeOnData подгоняет колонки на приходе данных и новой ссылке data, кроме протянутых пользователем; onColumnResizeEnd не зовёт', async () => {
    const onColumnResizeEnd = vi.fn()
    const plugins = [
      columnSizing({ autosizeOnData: true, onColumnResizeEnd }),
      headerActionMenu(),
    ]
    const short = rowsOf(10, 'Ann')
    const screen = await render(<Grid data={short} plugins={plugins} />)
    await waitForGrid()
    await expect.poll(() => widthOf('a')).toBeLessThan(100)
    const fitted = widthOf('a')
    // Пользователь протянул колонку «b» — новые данные её не трогают.
    const own = widthOf('b')
    head('b').querySelector<HTMLElement>('[role="separator"]')!.focus()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await expect.poll(() => widthOf('b')).toBeGreaterThan(own)
    const resized = widthOf('b')
    onColumnResizeEnd.mockClear()

    await screen.rerender(<Grid data={rowsOf(10)} plugins={plugins} />)
    await expect.poll(() => widthOf('a')).toBeGreaterThan(fitted + 100)
    await expect.poll(() => fits('a')).toBe(true)
    await nextFrame()
    expect(widthOf('b')).toBe(resized)
    expect(onColumnResizeEnd).not.toHaveBeenCalled()
  })

  test('AZ6: подгонка пользователем пишет ширину в columnSizing, зовёт onColumnResizeEnd и сообщает autosize в канал действий', async () => {
    const onColumnResizeEnd = vi.fn()
    const onDebugAction = vi.fn()
    const sizes: Record<string, number>[] = []
    const Controlled = () => {
      const [sizing, setSizing] = useState<Record<string, number>>({})
      return (
        <Grid
          plugins={[columnSizing({ onColumnResizeEnd }), headerActionMenu()]}
          extra={{
            onDebugAction,
            state: { columnSizing: sizing },
            handlers: {
              onColumnSizingChange: (updater: unknown) =>
                setSizing(old => {
                  const next =
                    typeof updater === 'function'
                      ? (updater as (o: object) => Record<string, number>)(old)
                      : (updater as Record<string, number>)
                  sizes.push(next)
                  return next
                }),
            },
          }}
        />
      )
    }
    await render(<Controlled />)
    await waitForGrid()
    await revealCellButtons(head('a'))
    await userEvent.dblClick(grip('a'))
    await expect.poll(() => fits('a')).toBe(true)
    expect(sizes.at(-1)?.a).toBe(widthOf('a'))
    expect(onColumnResizeEnd).toHaveBeenCalledWith({
      id: 'a',
      width: widthOf('a'),
    })
    expect(
      onDebugAction.mock.calls.some(
        ([action]) =>
          action.plugin === 'columnSizing' &&
          action.action === 'autosize' &&
          action.source === 'pointer',
      ),
    ).toBe(true)
  })

  test('AZ7: подогнанная флекс-колонка остаётся флекс: ширина содержимого — нижняя граница, остаток ширины делится по весам, onColumnResizeEnd у неё не зовётся; сброс ширины снимает границу', async () => {
    const onColumnResizeEnd = vi.fn()
    let table: any
    await render(
      <Grid
        width={700}
        columns={columnsOf(3)}
        defaultColumn={{ flex: 1 }}
        plugins={[columnSizing({ onColumnResizeEnd }), headerActionMenu()]}
        onTable={value => (table = value)}
      />,
    )
    await waitForGrid()
    const sum = () =>
      Math.round(
        ['a', 'b', 'c2'].reduce(
          (total, id) => total + head(id).getBoundingClientRect().width,
          0,
        ),
      )
    await expect.poll(sum).toBe(scroller().clientWidth)
    const share = widthOf('b')
    expect(fits('a')).toBe(false)
    await table.autosizeColumns()
    await expect.poll(() => fits('a')).toBe(true)
    // Таблица по-прежнему на всю ширину; остальные делят остаток поровну.
    expect(sum()).toBe(scroller().clientWidth)
    expect(widthOf('b')).toBeLessThan(share)
    expect(Math.abs(widthOf('b') - widthOf('c2'))).toBeLessThanOrEqual(1)
    expect(onColumnResizeEnd).not.toHaveBeenCalled()
    // Сброс ширины колонки — граница снята, колонка снова делит поровну.
    head('a').querySelector<HTMLElement>('[role="separator"]')!.focus()
    await userEvent.keyboard('{Home}')
    await expect
      .poll(() => Math.abs(widthOf('a') - share))
      .toBeLessThanOrEqual(1)
  })

  test('AZ8: колонки вне окна виртуализации колонок подгоняются по строкам окна; после замера окно прежнее', async () => {
    let table: any
    await render(
      <Grid
        width={600}
        columns={columnsOf(60)}
        onTable={value => (table = value)}
      />,
    )
    await waitForGrid()
    const mounted = () =>
      document.querySelectorAll('.data-grid__head-cell').length
    expect(head('c59')).toBeNull()
    await table.autosizeColumns()
    await nextFrame()
    await nextFrame()
    // Временно смонтированные колонки ушли: окно — снова у левого края.
    expect(head('c59')).toBeNull()
    expect(mounted()).toBeLessThan(20)
    scroller().scrollLeft = scroller().scrollWidth
    await expect.poll(() => head('c59')).not.toBeNull()
    expect(widthOf('c59')).not.toBe(100)
  })

  test('AZ9: подписи пунктов — из localization', async () => {
    const Localized = () => {
      const table = useCreateTable({
        columns: columnsOf() as never,
        data: rowsOf(5),
        getRowId: (row: Row) => row.id,
        plugins: [columnSizing(), headerActionMenu()] as never,
      })
      return (
        <div style={{ width: 600, height: 300 }}>
          <DataGrid
            table={table as never}
            localization={{
              'columnSizing.autosizeColumn': 'Подогнать ширину',
              'columnSizing.autosizeAllColumns': 'Подогнать все колонки',
            }}
          />
        </div>
      )
    }
    await render(<Localized />)
    await waitForGrid()
    await revealCellButtons(head('a'))
    await humanClick(kebab('a'))
    await expect
      .poll(() => menuItem('columnSizing.autosize')?.textContent)
      .toContain('Подогнать ширину')
    expect(menuItem('columnSizing.autosizeAll')!.textContent).toContain(
      'Подогнать все колонки',
    )
    await userEvent.keyboard('{Escape}')
  })
})
