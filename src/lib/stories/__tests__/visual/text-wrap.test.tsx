import { useState } from 'react'
import axe from 'axe-core'
import { commands, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { scrollLayer } from '../../../core/scrollStretch'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  rowDragging,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
  columnFiltering,
  columnFilteringModel,
  columnPinning,
  columnSizing,
  columnSorting,
  columnSortingModel,
  infiniteScroll,
  pagination,
  paginationModel,
  rowExpandingModel,
  rowGrouping,
  rowGroupingModel,
  textWrap,
  type TextWrapOptions,
} from '../../../plugins'
import { humanClick, revealCellButtons, settleRowMotion } from '../helpers'
import { AXE_OPTIONS, inBothThemes } from './a11y-helpers'
import { waitForGrid } from './core-helpers'

// Перенос текста и высота строк по содержимому (ADR 0218, этап 1).

const LINE = 'lorem ipsum dolor sit amet'
const LINE_HEIGHT = 16
const PADDING_Y = 8
const ROW_HEIGHT = 50

interface Row {
  id: string
  name: string
  note: string
  extra: string
  group: string
}

const text = (lines: number) =>
  Array.from({ length: lines }, () => LINE).join(' ')

/** Строка `i`: заметка из `lines(i)` фраз — примерно столько строк в колонке 220px. */
const makeRows = (count: number, lines: (i: number) => number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Name ${i}`,
    note: text(lines(i)),
    extra: '',
    group: `Group ${Math.floor(i / 10)}`,
  }))

/** Разные высоты: 1–5 фраз по кругу. */
const varied = (i: number) => 1 + ((i * 7) % 5)

type AnyTable = {
  scrollToRow: (id: string, options?: object) => Promise<boolean>
  scrollToRowIndex: (index: number, options?: object) => Promise<boolean>
  setColumnSizing: (sizing: Record<string, number>) => void
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
  setColumnFilters: (filters: { id: string; value: unknown }[]) => void
  setPageIndex: (index: number) => void
  setColumnVisibility: (visibility: Record<string, boolean>) => void
}

let table: AnyTable
let setData: (data: Row[]) => void = () => {}
let setRowHeight: (height: number | undefined) => void = () => {}

interface HostProps {
  data: Row[]
  /** Поля колонок по id. */
  defs?: Record<string, Record<string, unknown>>
  plugin?: TextWrapOptions | false
  plugins?: unknown[]
  rowHeight?: number
  height?: number
  options?: Record<string, unknown>
}

const Host = ({
  data: initialData,
  defs = {},
  plugin = {},
  plugins = [],
  rowHeight: initialRowHeight,
  height = 500,
  options = {},
}: HostProps) => {
  const [data, setHostData] = useState(initialData)
  const [rowHeight, setHostRowHeight] = useState(initialRowHeight)
  setData = setHostData
  setRowHeight = setHostRowHeight
  const created = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 160 },
      { id: 'note', accessorKey: 'note', header: 'Note', size: 220 },
      { id: 'extra', accessorKey: 'extra', header: 'Extra', size: 160 },
      { id: 'group', accessorKey: 'group', header: 'Group', size: 120 },
    ].map(column => ({ ...column, ...defs[column.id] })) as never,
    data,
    getRowId: (row: Row) => row.id,
    rowHeight,
    ...options,
    plugins: [
      ...plugins,
      ...(plugin === false ? [] : [textWrap(plugin)]),
    ] as never,
  })
  table = created as unknown as AnyTable
  return (
    <div style={{ width: 640, height: height + 20 }}>
      <DataGrid table={created as never} height={height} />
    </div>
  )
}

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]:not([data-sticky-copy])`,
  )
const cellOf = (id: string, column: string) =>
  rowOf(id)?.querySelector<HTMLElement>(`[data-column-id="${column}"]`)
const titleOf = (id: string, column: string) =>
  cellOf(id, column)?.querySelector<HTMLElement>(
    '.data-grid__cell-wrapper-title',
  )
const wrapperOf = (id: string, column: string) =>
  cellOf(id, column)?.querySelector<HTMLElement>(
    '.data-grid__cell-wrapper-content',
  )
const headCellOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const heightOf = (element: Element | null | undefined) =>
  element ? Math.round(element.getBoundingClientRect().height) : -1
const topOf = (element: Element | null | undefined) =>
  element ? element.getBoundingClientRect().top : Number.NaN
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const frames = async (count: number) => {
  for (let i = 0; i < count; i++) await frame()
}

/** Строки тела в DOM по порядку индекса. */
const mountedRows = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-row-id]:not([data-sticky-copy])',
    ),
  ].sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))

/** Верх видимой части тела — низ липкой шапки. */
const bodyTop = () =>
  document.querySelector('.data-grid__head')!.getBoundingClientRect().bottom

/** Первая строка, видимая у верха тела. */
const firstVisible = () =>
  mountedRows().find(row => row.getBoundingClientRect().bottom > bodyTop() + 1)!

/** Высота тела по DOM-замеру и подписи грида. */
const bodyHeight = () =>
  parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-body-height'),
  )

const openTips = () =>
  [...document.querySelectorAll('[role="presentation"][data-open]')].map(
    element => element.textContent ?? '',
  )

const wheel = commands as unknown as {
  realWheel: (
    at: { x: number; y: number },
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
}

interface Call {
  request: ServerRowsRequest
  answer: () => void
}

/** «Сервер» строк: `now` — ответить сразу (`true`), отказать (`Error`) или ждать команды теста. */
const rowsServer = (
  total: number,
  now: (request: ServerRowsRequest) => boolean | Error,
) => {
  const pending: Call[] = []
  const getRows = (request: ServerRowsRequest) =>
    new Promise<ServerRowsResponse<Row>>((resolve, reject) => {
      const answer = () =>
        resolve({
          rowCount: total,
          rows: Array.from({ length: request.end - request.start }, (_, k) => {
            const i = request.start + k
            return {
              id: String(i),
              name: `Name ${i}`,
              note: text(varied(i)),
              extra: '',
              group: '',
            }
          }),
        })
      const verdict = now(request)
      if (verdict instanceof Error) reject(verdict)
      else if (verdict) answer()
      else pending.push({ request, answer })
    })
  return {
    getRows,
    count: () => pending.length,
    waiting: () => pending.splice(0),
  }
}

const ServerHost = ({
  getRows,
  total,
  estimate,
}: {
  getRows: ReturnType<typeof rowsServer>['getRows']
  total: number
  estimate?: number
}) => {
  const created = useCreateTable({
    columns: [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 160 },
      {
        id: 'note',
        accessorKey: 'note',
        header: 'Note',
        size: 220,
        autoHeight: true,
      },
    ] as never,
    data: [],
    totalRowCount: total,
    getRowId: (row: Row) => row.id,
    plugins: [
      serverRowModel({ getRows, blockSize: 100 }),
      textWrap({ estimatedRowHeight: estimate }),
    ] as never,
  })
  table = created as unknown as AnyTable
  return (
    <div style={{ width: 600, height: 520 }}>
      <DataGrid table={created as never} height={500} />
    </div>
  )
}

/** Окно загружено и замерено: нет скелетов незагруженных строк. */
const loadedWindow = async () => {
  await expect
    .poll(() =>
      document.querySelector(
        '[data-pending-row], .data-grid__body [data-skeleton]',
      ),
    )
    .toBeNull()
  await frames(2)
}

describe('Перенос текста и высота строк по содержимому', () => {
  test('AH1: wrapText переносит текст по словам: видно столько целых строк, сколько помещается в rowHeight, последняя кончается …', async () => {
    await render(
      <Host
        data={makeRows(20, () => 6)}
        defs={{ note: { wrapText: true } }}
        rowHeight={72}
      />,
    )
    await waitForGrid()
    const title = titleOf('0', 'note')!
    // 72px без отступов 8px по высоте — 3 целые строки по 16px.
    expect(heightOf(title)).toBe(3 * LINE_HEIGHT)
    expect(getComputedStyle(title).webkitLineClamp).toBe('3')
    expect(getComputedStyle(title).whiteSpace).toBe('normal')
    expect(getComputedStyle(title).textOverflow).toBe('ellipsis')
    expect(title.scrollHeight).toBeGreaterThan(title.clientHeight)
    expect(heightOf(rowOf('0'))).toBe(72)
  })

  test('AH2: тултип обрезанного текста у перенесённой ячейки — только когда текст не поместился по высоте', async () => {
    await render(
      <Host
        data={makeRows(20, i => (i === 0 ? 8 : 1))}
        defs={{ note: { wrapText: true } }}
      />,
    )
    await waitForGrid()
    const long = titleOf('0', 'note')!
    const short = titleOf('1', 'note')!
    // Перенос не даёт обрезки по ширине — только по высоте.
    expect(long.scrollWidth).toBeLessThanOrEqual(long.clientWidth)

    await userEvent.hover(long)
    await expect
      .poll(() => openTips().some(tip => tip.includes(LINE)), { timeout: 2000 })
      .toBe(true)
    await userEvent.hover(short)
    await expect.poll(() => openTips().length, { timeout: 2000 }).toBe(0)
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(openTips()).toEqual([])
  })

  test('AH3: autoHeight — высота строки по наибольшему содержимому её колонок, не меньше rowHeight; ячейки во всю высоту', async () => {
    await render(
      <Host
        data={makeRows(30, i => (i === 1 ? 4 : i === 2 ? 1 : 0))}
        defs={{ note: { autoHeight: true } }}
      />,
    )
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('1'))).toBeGreaterThan(ROW_HEIGHT)
    const title = titleOf('1', 'note')!
    // Текст целиком: строка — текст и отступы по высоте.
    expect(title.scrollHeight).toBe(title.clientHeight)
    expect(heightOf(rowOf('1'))).toBe(heightOf(title) + 2 * PADDING_Y)
    expect(heightOf(rowOf('2'))).toBe(ROW_HEIGHT)
    expect(heightOf(rowOf('0'))).toBe(ROW_HEIGHT)
    expect(heightOf(cellOf('1', 'name'))).toBe(heightOf(rowOf('1')))
    expect(heightOf(cellOf('1', 'note'))).toBe(heightOf(rowOf('1')))
    expect(Math.round(topOf(rowOf('2')))).toBe(
      Math.round(rowOf('1')!.getBoundingClientRect().bottom),
    )
  })

  test('AH4: без плагина textWrap поля wrapText и autoHeight не действуют — строки фиксированной высоты, текст в одну строку', async () => {
    await render(
      <Host
        data={makeRows(20, () => 6)}
        defs={{ note: { autoHeight: true }, name: { wrapText: true } }}
        plugin={false}
      />,
    )
    await waitForGrid()
    expect(new Set(mountedRows().map(heightOf))).toEqual(new Set([ROW_HEIGHT]))
    expect(getComputedStyle(titleOf('0', 'note')!).whiteSpace).toBe('nowrap')
    expect(document.querySelector('[data-text-wrap]')).toBeNull()
  })

  test('AH6: предел maxLines плагина и autoHeight: { maxLines } колонки — дальше … с тултипом, строка не выше предела', async () => {
    const view = await render(
      <Host
        data={makeRows(20, () => 12)}
        defs={{ note: { autoHeight: true } }}
        plugin={{ maxLines: 3 }}
      />,
    )
    await waitForGrid()
    await expect
      .poll(() => heightOf(rowOf('0')))
      .toBe(3 * LINE_HEIGHT + 2 * PADDING_Y)
    const title = titleOf('0', 'note')!
    expect(title.scrollHeight).toBeGreaterThan(title.clientHeight)
    await userEvent.hover(title)
    await expect
      .poll(() => openTips().some(tip => tip.includes(LINE)), { timeout: 2000 })
      .toBe(true)
    await view.unmount()

    // Свой предел колонки главнее предела плагина; по умолчанию — 10 строк.
    const own = await render(
      <Host
        data={makeRows(20, () => 12)}
        defs={{ note: { autoHeight: { maxLines: 5 } } }}
        plugin={{ maxLines: 3 }}
      />,
    )
    await waitForGrid()
    await expect
      .poll(() => heightOf(rowOf('0')))
      .toBe(5 * LINE_HEIGHT + 2 * PADDING_Y)
    await own.unmount()

    await render(
      <Host
        data={makeRows(20, () => 30)}
        defs={{ note: { autoHeight: true } }}
      />,
    )
    await waitForGrid()
    await expect
      .poll(() => heightOf(rowOf('0')))
      .toBe(10 * LINE_HEIGHT + 2 * PADDING_Y)
  })

  test('AH7: высота строки — наибольшая среди колонок autoHeight, закреплённых слева, справа и центральных; ячейки строки одной высоты', async () => {
    const data = makeRows(20, () => 1).map((row, i) => ({
      ...row,
      name: i === 0 ? text(2) : row.name,
      note: i === 1 ? text(4) : row.note,
      extra: i === 2 ? text(5) : '',
    }))
    await render(
      <Host
        data={data}
        defs={{
          name: { autoHeight: true },
          note: { autoHeight: true },
          extra: { autoHeight: true },
        }}
        plugins={[columnPinning()]}
        options={{
          state: { columnPinning: { start: ['name'], end: ['extra'] } },
        }}
      />,
    )
    await waitForGrid()
    expect(cellOf('0', 'name')!.dataset.cellPinned).toBe('left')
    expect(cellOf('0', 'extra')!.dataset.cellPinned).toBe('right')
    for (const [id, column] of [
      ['0', 'name'],
      ['1', 'note'],
      ['2', 'extra'],
    ] as const) {
      await expect
        .poll(() => heightOf(rowOf(id)))
        .toBe(heightOf(wrapperOf(id, column)))
      expect(heightOf(rowOf(id))).toBeGreaterThan(ROW_HEIGHT)
      for (const cell of ['name', 'note', 'extra', 'group']) {
        expect(heightOf(cellOf(id, cell))).toBe(heightOf(rowOf(id)))
      }
    }
  })

  test('AH8: колонки autoHeight рисуются вне окна виртуализации колонок — при горизонтальной прокрутке 1000 колонок высота строк не меняется', async () => {
    const extra = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${i}`,
      accessorFn: () => `v${i}`,
      header: `C${i}`,
      size: 100,
    }))
    const Wide = () => {
      const created = useCreateTable({
        columns: [
          {
            id: 'note',
            accessorKey: 'note',
            header: 'Note',
            size: 220,
            autoHeight: true,
          },
          ...extra,
        ] as never,
        data: makeRows(30, i => (i === 0 ? 4 : 1)),
        getRowId: (row: Row) => row.id,
        plugins: [textWrap()] as never,
      })
      return (
        <div style={{ width: 640, height: 520 }}>
          <DataGrid table={created as never} height={500} />
        </div>
      )
    }
    await render(<Wide />)
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('0'))).toBeGreaterThan(ROW_HEIGHT)
    const tall = heightOf(rowOf('0'))
    scroller().scrollLeft = 60_000
    await frames(4)
    expect(document.querySelector('[data-column-id="c600"]')).not.toBeNull()
    expect(cellOf('0', 'note')).not.toBeNull()
    expect(heightOf(rowOf('0'))).toBe(tall)
    scroller().scrollLeft = scroller().scrollWidth
    await frames(4)
    expect(heightOf(rowOf('0'))).toBe(tall)
  })

  test('AH9: строки групп, хвоста ленты и футер — высотой rowHeight, и при оценке выше строки', async () => {
    const data = makeRows(40, () => 6).map(row => ({
      ...row,
      // Значение группы — длинный текст колонки autoHeight.
      note: `${text(6)} ${row.group}`,
    }))
    const view = await render(
      <Host
        data={data}
        defs={{ note: { autoHeight: true, footer: () => text(6) } }}
        plugin={{ estimatedRowHeight: 90 }}
        plugins={[
          rowGroupingModel({ initialGrouping: ['note'] }),
          rowGrouping(),
        ]}
        options={{ enableFooter: true }}
      />,
    )
    await waitForGrid()
    const groups = () =>
      mountedRows().filter(row => row.dataset.groupRow === 'true')
    await expect.poll(() => groups().length).toBeGreaterThan(2)
    await frames(3)
    for (const row of groups()) expect(heightOf(row)).toBe(ROW_HEIGHT)
    expect(heightOf(document.querySelector('.data-grid__footer'))).toBe(
      ROW_HEIGHT,
    )
    await view.unmount()

    // Хвост ленты — скелет-строки высотой строки, а не оценки.
    await render(
      <Host
        data={makeRows(8, () => 1)}
        defs={{ note: { autoHeight: true } }}
        plugin={{ estimatedRowHeight: 90 }}
        plugins={[
          infiniteScroll({
            hasMore: true,
            onLoadMore: () => new Promise<void>(() => {}),
          }),
        ]}
      />,
    )
    await waitForGrid()
    const tail = () => [
      ...document.querySelectorAll(
        '.data-grid__body-row--infinite-tail, .data-grid__body--infinite-tail .data-grid__body-row--skeleton',
      ),
    ]
    await expect.poll(() => tail().length).toBeGreaterThan(0)
    for (const row of tail()) expect(heightOf(row)).toBe(ROW_HEIGHT)
  })

  test('AH10: меряются только отрисованные строки, незамеренные — высотой оценки; полная высота тела — замеры окна и оценка остальных', async () => {
    const count = 100_000
    await render(
      <Host
        data={makeRows(count, varied)}
        defs={{ note: { autoHeight: true } }}
        plugin={{ estimatedRowHeight: 70 }}
      />,
    )
    await waitForGrid()
    await frames(3)
    const rows = mountedRows()
    const measured = rows.reduce((sum, row) => sum + heightOf(row), 0)
    expect(new Set(rows.map(heightOf)).size).toBeGreaterThan(1)
    expect(Math.round(bodyHeight())).toBe(measured + (count - rows.length) * 70)
  })

  test('AH11: замеры строк выше экрана не сдвигают видимые строки — с клавиатурной навигацией и без', async () => {
    for (const navigation of [false, true]) {
      const view = await render(
        <Host
          data={makeRows(3000, varied)}
          defs={{ note: { autoHeight: true } }}
          plugins={[columnSizing()]}
          options={{ enableKeyboardNavigation: navigation }}
        />,
      )
      await waitForGrid()
      // Строки по пути вниз замерены и запомнены.
      for (let top = 0; top <= 30_000; top += 400) {
        scroller().scrollTop = top
        await frame()
      }
      await frames(3)
      // Колонка уже: строки вне окна держат прежнюю высоту и перемеряются при возврате.
      table.setColumnSizing({ note: 140 })
      await frames(3)
      for (let step = 0; step < 8; step++) {
        const anchor = firstVisible()
        const id = anchor.dataset.rowId!
        const before = topOf(anchor)
        scroller().scrollTop -= 300
        await frames(3)
        // Строка экрана сдвинулась ровно на прокрутку: строки над ней перемерились без сдвига.
        expect(
          Math.abs(topOf(rowOf(id)) - (before + 300)),
          `${navigation ? 'навигация' : 'без навигации'}, шаг ${step}`,
        ).toBeLessThanOrEqual(1)
      }
      // Прыжок в незамеренные строки: строка у верхнего края замеряется впервые, когда приходит
      // её содержимое, — она стоит на месте, растут строки под ней.
      scroller().scrollTop = 120_025
      await frame()
      const edge = firstVisible()
      const edgeTop = topOf(edge)
      const edgeId = edge.dataset.rowId!
      await expect
        .poll(() => document.querySelector('.data-grid__body [data-skeleton]'))
        .toBeNull()
      await frames(2)
      expect(
        Math.abs(topOf(rowOf(edgeId)) - edgeTop),
        navigation ? 'навигация, край' : 'без навигации, край',
      ).toBeLessThanOrEqual(1)
      await view.unmount()
    }
  })

  test('AH12: замер хранится по id строки — после ухода из окна и возврата, сортировки, фильтра и смены страницы высота прежняя с первого кадра', async () => {
    const data = makeRows(400, i => (i === 3 ? 5 : 1))
    /** Высота строки `id` в первой записи её узла в DOM: до замера. */
    const firstHeight = (id: string) =>
      new Promise<string>(resolve => {
        const observer = new MutationObserver(() => {
          const row = rowOf(id)
          if (!row) return
          observer.disconnect()
          resolve(row.style.height)
        })
        observer.observe(document.body, { childList: true, subtree: true })
      })
    const view = await render(
      <Host
        data={data}
        defs={{ note: { autoHeight: true } }}
        plugins={[columnSortingModel(), columnSorting()]}
      />,
    )
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('3'))).toBeGreaterThan(ROW_HEIGHT)
    const tall = `${heightOf(rowOf('3'))}px`

    // Уход из окна и возврат.
    scroller().scrollTop = 15_000
    await expect.poll(() => rowOf('3')).toBeNull()
    let first = firstHeight('3')
    scroller().scrollTop = 0
    expect(await first).toBe(tall)

    // Сортировка уводит строку в конец и обратно.
    table.setSorting([{ id: 'name', desc: true }])
    await expect.poll(() => rowOf('3')).toBeNull()
    first = firstHeight('3')
    table.setSorting([])
    expect(await first).toBe(tall)
    await view.unmount()

    // Фильтр прячет строку и снимается.
    const filtered = await render(
      <Host
        data={data}
        defs={{ note: { autoHeight: true } }}
        plugins={[columnFilteringModel(), columnFiltering()]}
      />,
    )
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('3'))).toBeGreaterThan(ROW_HEIGHT)
    table.setColumnFilters([
      { id: 'name', value: { operator: 'contains', value: 'Name 39' } },
    ])
    await expect.poll(() => rowOf('3')).toBeNull()
    first = firstHeight('3')
    table.setColumnFilters([])
    expect(await first).toBe(tall)
    await filtered.unmount()

    // Страница уходит и возвращается.
    await render(
      <Host
        data={makeRows(400, i => (i === 3 ? 5 : 1))}
        defs={{ note: { autoHeight: true } }}
        plugins={[paginationModel({ initialPageSize: 50 }), pagination()]}
      />,
    )
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('3'))).toBe(Number.parseInt(tall))
    table.setPageIndex(1)
    await expect.poll(() => rowOf('3')).toBeNull()
    first = firstHeight('3')
    table.setPageIndex(0)
    expect(await first).toBe(tall)
  })

  test('AH13: строка перемеряется при смене её данных, ширины колонки (протяжкой и на лету), видимости колонки и rowHeight', async () => {
    const data = makeRows(30, i => (i === 0 ? 2 : 1))
    await render(
      <Host
        data={data}
        defs={{ note: { autoHeight: true } }}
        plugins={[columnSizing()]}
      />,
    )
    await waitForGrid()
    const row0 = () => heightOf(rowOf('0'))
    await expect.poll(row0).toBe(ROW_HEIGHT)

    // Данные строки.
    setData(data.map(row => (row.id === '0' ? { ...row, note: text(4) } : row)))
    await expect.poll(row0).toBeGreaterThan(ROW_HEIGHT)
    const fourLines = row0()

    // Ширина на лету.
    table.setColumnSizing({ note: 120 })
    await expect.poll(row0).toBeGreaterThan(fourLines)
    // Грип колонки — в окне теста шириной 414px.
    table.setColumnSizing({ name: 60, note: 300 })
    await expect.poll(row0).toBeLessThan(fourLines)
    const wide = row0()

    // Ширина протяжкой грипа.
    const head = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="note"]',
    )!
    await userEvent.hover(head)
    const grip = head.querySelector<HTMLElement>('[role="separator"]')!
    // Грип проявляется по наведению: нажатие до конца проявления уходит мимо.
    await expect
      .poll(() => grip.checkVisibility({ opacityProperty: true }))
      .toBe(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    const separator = grip.getBoundingClientRect()
    const from = {
      x: separator.left + separator.width / 2,
      y: separator.top + separator.height / 2,
    }
    await (
      commands as unknown as {
        realDrag: (from: object, to: object) => Promise<void>
      }
    ).realDrag(from, { x: from.x - 180, y: from.y })
    await expect.poll(row0).toBeGreaterThan(wide)

    // Видимость колонки.
    table.setColumnVisibility({ note: false })
    await expect.poll(row0).toBe(ROW_HEIGHT)
    table.setColumnVisibility({ note: true })
    await expect.poll(row0).toBeGreaterThan(ROW_HEIGHT)

    // Высота строки: короткая строка — новая высота, высокая — не ниже содержимого.
    const need = heightOf(wrapperOf('0', 'note'))
    setRowHeight(need + 30)
    await expect.poll(() => heightOf(rowOf('1'))).toBe(need + 30)
    await expect.poll(row0).toBe(need + 30)
  })

  test('AH17: замер не даёт кадра, где содержимое ячейки выше строки — новая высота и места строк ниже в одной отрисовке', async () => {
    await render(
      <Host
        data={makeRows(3000, varied)}
        defs={{ note: { autoHeight: true } }}
      />,
    )
    await waitForGrid()
    const clipped: string[] = []
    // Выборка каждого кадра: строка ниже содержимого своей ячейки или зазор между строками.
    let sampling = true
    const sample = () => {
      for (const row of mountedRows()) {
        const wrapper = row.querySelector(
          '[data-column-id="note"] .data-grid__cell-wrapper-content',
        )
        if (!wrapper || row.querySelector('[data-skeleton]')) continue
        if (heightOf(wrapper) > heightOf(row)) clipped.push(row.dataset.rowId!)
        const next = row.nextElementSibling as HTMLElement | null
        if (
          next?.dataset.index === String(Number(row.dataset.index) + 1) &&
          Math.abs(topOf(next) - row.getBoundingClientRect().bottom) > 0.5
        ) {
          clipped.push(`${row.dataset.rowId}↔${next.dataset.rowId}`)
        }
      }
      if (sampling) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    // Строки, смонтированные в прокрутке, — скелеты до её остановки (FS6): содержимое приходит
    // после остановки, его замер и смотрит выборка.
    for (let stop = 0; stop < 5; stop++) {
      for (let step = 0; step < 20; step++) {
        scroller().scrollTop += 30
        await frame()
      }
      await new Promise(resolve => setTimeout(resolve, 700))
    }
    sampling = false
    expect(clipped).toEqual([])
  })

  test('AH18: PageUp/PageDown листают на высоту видимой области в пикселях по строкам разной высоты', async () => {
    await render(
      <Host
        data={makeRows(300, i => (i % 3 === 0 ? 5 : 1))}
        defs={{ note: { autoHeight: true } }}
        options={{ enableKeyboardNavigation: true }}
      />,
    )
    await waitForGrid()
    await frames(3)
    const page =
      scroller().clientHeight -
      (bodyTop() - scroller().getBoundingClientRect().top)
    /** Индекс строки, чья полоса содержит место `y` от начала тела. */
    const rowAt = (y: number) => {
      const start = topOf(mountedRows()[0]) - Number(0)
      return mountedRows().find(row => {
        const top = topOf(row) - start
        return top <= y && y < top + heightOf(row)
      })!
    }
    const expected = Number(rowAt(page).dataset.index)
    // Строки одной высоты дали бы другой ответ: листание не по числу строк.
    expect(expected).not.toBe(Math.floor(page / ROW_HEIGHT))

    await userEvent.click(cellOf('0', 'name')!)
    await userEvent.keyboard('{PageDown}')
    await expect
      .poll(
        () =>
          document.activeElement?.closest<HTMLElement>('[data-row-id]')?.dataset
            .index,
      )
      .toBe(String(expected))
    await userEvent.keyboard('{PageUp}')
    await expect
      .poll(
        () =>
          document.activeElement?.closest<HTMLElement>('[data-row-id]')?.dataset
            .index,
      )
      .not.toBe(String(expected))
  })

  test('AH19: стрелка к строке выше видимой области ставит её верхом к краю', async () => {
    await render(
      <Host
        data={makeRows(40, i => (i === 2 ? 30 : 1))}
        defs={{ note: { autoHeight: true } }}
        options={{ enableKeyboardNavigation: true }}
        height={180}
      />,
    )
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('2'))).toBeGreaterThan(150)
    await userEvent.click(cellOf('1', 'name')!)
    await userEvent.keyboard('{ArrowDown}')
    await expect
      .poll(
        () =>
          document.activeElement?.closest<HTMLElement>('[data-row-id]')?.dataset
            .rowId,
      )
      .toBe('2')
    await frames(2)
    expect(Math.abs(topOf(rowOf('2')) - bodyTop())).toBeLessThanOrEqual(1)
  })

  test('AH20: scrollToRow к незамеренной строке — мгновенно и плавно, при всех выравниваниях — ставит её по выравниванию без обратного рывка', async () => {
    await render(
      <Host
        data={makeRows(3000, varied)}
        defs={{ note: { autoHeight: true } }}
      />,
    )
    await waitForGrid()
    const viewport = () => ({
      top: bodyTop(),
      bottom: scroller().getBoundingClientRect().top + scroller().clientHeight,
    })
    const check = (id: string, align: string) => {
      const box = rowOf(id)!.getBoundingClientRect()
      const { top, bottom } = viewport()
      if (align === 'start') return Math.abs(box.top - top)
      if (align === 'end') return Math.abs(box.bottom - bottom)
      return Math.abs((box.top + box.bottom) / 2 - (top + bottom) / 2)
    }
    for (const [id, align] of [
      ['1500', 'start'],
      ['2200', 'center'],
      ['900', 'end'],
    ] as const) {
      expect(await table.scrollToRow(id, { align })).toBe(true)
      await frames(3)
      expect(check(id, align)).toBeLessThanOrEqual(1)
    }

    // Плавно: прокрутка идёт в одну сторону, строка встаёт по выравниванию.
    const tops: number[] = []
    const record = () => tops.push(scroller().scrollTop)
    scroller().addEventListener('scroll', record)
    expect(
      await table.scrollToRow('2900', { align: 'start', behavior: 'smooth' }),
    ).toBe(true)
    await frames(3)
    scroller().removeEventListener('scroll', record)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i]!).toBeGreaterThanOrEqual(tops[i - 1]! - 1)
    }
    expect(check('2900', 'start')).toBeLessThanOrEqual(1)
  })

  test('AH21: вставка и удаление строк выше экрана удерживают первую видимую строку по её замеренной высоте', async () => {
    const data = makeRows(600, varied)
    await render(<Host data={data} defs={{ note: { autoHeight: true } }} />)
    await waitForGrid()
    scroller().scrollTop = 8000
    await frames(4)
    const anchor = firstVisible()
    const id = anchor.dataset.rowId!
    const before = topOf(anchor)

    const inserted = makeRows(5, () => 5).map(row => ({
      ...row,
      id: `new-${row.id}`,
    }))
    setData([...inserted, ...data])
    await frames(4)
    expect(Math.abs(topOf(rowOf(id)) - before)).toBeLessThanOrEqual(1)

    setData(data.slice(20))
    await frames(4)
    expect(Math.abs(topOf(rowOf(id)) - before)).toBeLessThanOrEqual(1)
  })

  test('AH22: липкие строки групп — высотой строки и выталкиваются по фактическому началу строк разной высоты', async () => {
    const data = makeRows(200, () => 4)
    await render(
      <Host
        data={data}
        defs={{ note: { autoHeight: true } }}
        plugins={[
          rowGroupingModel({ initialGrouping: ['group'] }),
          rowExpandingModel({ initialExpanded: true }),
          rowGrouping({ stickyRows: true }),
        ]}
      />,
    )
    await waitForGrid()
    const sticky = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-sticky-copy]',
      )
    // Следующая группа под липкой строкой выталкивает её вверх.
    const nextGroup = () =>
      mountedRows().find(
        row => row.dataset.groupRow === 'true' && topOf(row) >= bodyTop() - 0.5,
      )
    for (let top = 0; top < 4000; top += 40) {
      scroller().scrollTop = top
      await frames(2)
      const copy = sticky()
      const next = nextGroup()
      if (!copy || !next) continue
      expect(heightOf(copy)).toBe(ROW_HEIGHT)
      // Липкая строка не заходит на следующую группу.
      expect(copy.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        topOf(next) + 0.5,
      )
    }
    expect(sticky()).not.toBeNull()
  })

  test('AH23: скелет первой загрузки — строки высотой estimatedRowHeight, их число по высоте области', async () => {
    await render(
      <Host
        data={[]}
        defs={{ note: { autoHeight: true } }}
        plugin={{ estimatedRowHeight: 80 }}
        options={{ loading: 'initial' }}
      />,
    )
    const skeletonRows = () => [
      ...document.querySelectorAll('.data-grid__body-row--skeleton'),
    ]
    await expect.poll(() => skeletonRows().length).toBeGreaterThan(2)
    for (const row of skeletonRows()) expect(heightOf(row)).toBe(80)
    const head = heightOf(document.querySelector('.data-grid__head'))
    expect(skeletonRows().length).toBe(
      Math.ceil((scroller().clientHeight - head) / 80),
    )
  })
  // Этап 2: растянутая область, серверная модель, движение, перетаскивание, правка.

  test('AH15: растянутая область — 1 000 000 строк с колонкой autoHeight: колесо 1:1, видимые строки не прыгают при замерах, scrollToRow попадает в строку в конце', async () => {
    const server = rowsServer(1_000_000, () => true)
    await render(<ServerHost getRows={server.getRows} total={1_000_000} />)
    await waitForGrid()
    await expect.poll(() => scrollLayer(scroller()).stretched).toBe(true)
    expect(await table.scrollToRowIndex(500_000, { align: 'start' })).toBe(true)
    await loadedWindow()
    const box = scroller().getBoundingClientRect()
    const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    // Колесо: строка экрана уходит ровно на прокрутку колеса.
    const anchor = firstVisible()
    const before = topOf(anchor)
    await wheel.realWheel(center, 120, 1, 0)
    await new Promise(resolve => setTimeout(resolve, 600))
    await loadedWindow()
    expect(
      Math.abs(topOf(rowOf(anchor.dataset.rowId!)) - (before - 120)),
    ).toBeLessThanOrEqual(1)
    // Строки выше экрана замеряются при прокрутке вверх — видимые стоят.
    for (let step = 0; step < 4; step++) {
      const seen = firstVisible()
      const top = topOf(seen)
      await wheel.realWheel(center, -120, 1, 0)
      await new Promise(resolve => setTimeout(resolve, 600))
      await loadedWindow()
      expect(
        Math.abs(topOf(rowOf(seen.dataset.rowId!)) - (top + 120)),
      ).toBeLessThanOrEqual(1)
    }
    // Строка в конце.
    expect(await table.scrollToRowIndex(999_990, { align: 'start' })).toBe(true)
    await loadedWindow()
    await frames(3)
    expect(Math.abs(topOf(rowOf('999990')) - bodyTop())).toBeLessThanOrEqual(1)
  })

  test('AH16: SSRM — незагруженные строки и скелеты блока высотой оценки, строка ошибки блока высотой строки; блок, пришедший выше экрана, не сдвигает видимые строки', async () => {
    let failing = false
    const server = rowsServer(5000, request =>
      failing ? new Error('down') : request.start < 100,
    )
    const view = await render(
      <ServerHost getRows={server.getRows} total={5000} estimate={90} />,
    )
    await waitForGrid()
    await loadedWindow()
    // Прыжок к началу незагруженного блока: строки ждут ответа — скелеты высотой оценки;
    // строка позади окна — из блока выше.
    void table.scrollToRowIndex(2300, { align: 'start' })
    await expect
      .poll(() => document.querySelectorAll('[data-pending-row]').length)
      .toBeGreaterThan(2)
    for (const row of document.querySelectorAll('[data-pending-row]')) {
      expect(heightOf(row)).toBe(90)
    }

    // Блоки отвечают от ближнего к экрану: блок выше экрана не сдвигает видимую строку.
    await expect.poll(() => server.count()).toBeGreaterThan(0)
    await new Promise(resolve => setTimeout(resolve, 300))
    const index = Number(
      [...document.querySelectorAll<HTMLElement>('[data-index]')].find(
        row => row.getBoundingClientRect().bottom > bodyTop() + 1,
      )!.dataset.index,
    )
    let above = false
    for (let wave = 0; wave < 12; wave++) {
      const calls = server
        .waiting()
        .sort((a, b) => b.request.start - a.request.start)
      if (calls.length === 0) {
        if (!document.querySelector('[data-pending-row]')) break
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }
      for (const call of calls) {
        const top = topOf(
          document.querySelector<HTMLElement>(`[data-index="${index}"]`),
        )
        call.answer()
        await frames(4)
        if (call.request.end <= index) {
          above = true
          const after = document.querySelector<HTMLElement>(
            `[data-index="${index}"]`,
          )
          expect(Math.abs(topOf(after) - top)).toBeLessThanOrEqual(1)
        }
      }
    }
    expect(above).toBe(true)

    // Отказ блока: пустые рамки строк блока — по оценке, строка ошибки — своего вида.
    failing = true
    void table.scrollToRowIndex(4000, { align: 'start' })
    const error = () =>
      document.querySelector<HTMLElement>('[data-testid="rows-load-error"]')
    await expect.poll(error).not.toBeNull()
    for (const row of document.querySelectorAll('[data-failed-row]')) {
      expect(heightOf(row)).toBe(90)
    }
    const withEstimate = heightOf(error())
    await view.unmount()
    const plain = rowsServer(5000, request =>
      request.start < 100 ? true : new Error('down'),
    )
    await render(<ServerHost getRows={plain.getRows} total={5000} />)
    await waitForGrid()
    void table.scrollToRowIndex(4000, { align: 'start' })
    await expect.poll(error).not.toBeNull()
    expect(withEstimate).toBe(heightOf(error()))
  })

  test('AH24: движение строк — с прежних мест к замеренным, призраки своей высоты, незакреплённый футер едет на разницу высоты тела; смена высоты от содержимого — без анимации', async () => {
    const data = makeRows(12, i => (i % 3 === 0 ? 4 : 1))
    await render(
      <Host
        data={data}
        defs={{ note: { autoHeight: true, footer: () => 'Total' } }}
        plugins={[columnSortingModel(), columnSorting(), columnSizing()]}
        options={{ enableFooter: true, footerPosition: 'inline' }}
        height={1200}
      />,
    )
    await waitForGrid()
    await frames(3)
    const body = document.querySelector<HTMLElement>('.data-grid__body')!
    const footer = () =>
      document.querySelector<HTMLElement>('.data-grid__footer')!
    const heights = new Set(mountedRows().map(heightOf))
    const tops = new Map(
      mountedRows().map(row => [row.dataset.rowId!, topOf(row)]),
    )
    const footerTop = topOf(footer())

    // Сортировка — строки едут с прежних мест.
    table.setSorting([{ id: 'name', desc: true }])
    await frame()
    expect(body.getAnimations({ subtree: true }).length).toBeGreaterThan(0)
    for (const animation of document.getAnimations()) {
      animation.pause()
      animation.currentTime = 0
    }
    for (const row of mountedRows()) {
      expect(
        Math.abs(topOf(row) - tops.get(row.dataset.rowId!)!),
      ).toBeLessThanOrEqual(1)
    }
    for (const animation of document.getAnimations()) animation.finish()
    await settleRowMotion()

    // Удаление высоких строк — призраки своей высоты, футер стартует с прежнего места.
    const before = topOf(footer())
    setData(data.filter(row => !['0', '3', '6'].includes(row.id)))
    await frame()
    for (const animation of document.getAnimations()) {
      animation.pause()
      animation.currentTime = 0
    }
    const ghosts = [
      ...document.querySelectorAll<HTMLElement>('[data-row-ghost]'),
    ]
    expect(ghosts.length).toBeGreaterThan(0)
    for (const ghost of ghosts) expect(heights.has(heightOf(ghost))).toBe(true)
    expect(ghosts.some(ghost => heightOf(ghost) > ROW_HEIGHT)).toBe(true)
    expect(Math.abs(topOf(footer()) - before)).toBeLessThanOrEqual(1)
    // Последний кадр движения — уже на новом месте: после движения футер не прыгает.
    for (const animation of document.getAnimations()) {
      animation.currentTime =
        Number(animation.effect?.getComputedTiming().endTime ?? 0) - 1
    }
    const landing = topOf(footer())
    for (const animation of document.getAnimations()) animation.finish()
    await settleRowMotion()
    await new Promise(resolve => setTimeout(resolve, 600))
    expect(topOf(footer())).toBeLessThan(footerTop)
    expect(Math.abs(topOf(footer()) - landing)).toBeLessThanOrEqual(2)

    // Колонка уже — строки выше, анимаций нет.
    table.setColumnSizing({ note: 120 })
    await frames(2)
    // Движение строк — анимации Web Animations, а не CSS-переходы наведения и фона.
    expect(
      body
        .getAnimations({ subtree: true })
        .filter(
          animation =>
            animation.playState === 'running' &&
            !(animation instanceof CSSTransition) &&
            !(animation instanceof CSSAnimation),
        ),
    ).toEqual([])
  })

  test('AH25: слот броска при перетаскивании строки — высотой с перетаскиваемую строку, соседи сдвигаются на неё; облако прежнее', async () => {
    await render(
      <Host
        data={makeRows(30, i => (i === 1 ? 5 : 1))}
        defs={{ note: { autoHeight: true } }}
        plugins={[rowDragging()]}
      />,
    )
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('1'))).toBeGreaterThan(ROW_HEIGHT)
    const tall = heightOf(rowOf('1'))
    const row = rowOf('1')!
    await userEvent.hover(row)
    const handle = row
      .querySelector<HTMLElement>('.drag__handler--column')!
      .getBoundingClientRect()
    const from = {
      x: handle.left + handle.width / 2,
      y: handle.top + handle.height / 2,
    }
    const over = rowOf('3')!.getBoundingClientRect()
    const pointer = commands as unknown as {
      realDragHold: (from: object, to: object) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    await pointer.realDragHold(from, {
      x: from.x,
      y: over.top + over.height / 2 + 4,
    })
    try {
      const slot = () =>
        document.querySelector<HTMLElement>(
          '.data-grid__body-row[data-row-draggable="true"]',
        )
      await expect.poll(slot).not.toBeNull()
      await frames(4)
      expect(heightOf(slot())).toBe(tall)
      // Соседи, обойдённые слотом, сдвинулись вверх ровно на высоту строки.
      const shift = (id: string) =>
        Number(
          /,\s*(-?[\d.]+)px,\s*0px\)$/.exec(rowOf(id)!.style.transform)?.[1] ??
            0,
        )
      await expect.poll(() => shift('2')).toBe(-tall)
      expect(
        heightOf(document.querySelector('.data-grid-body__row > :first-child')),
      ).toBe(ROW_HEIGHT)
    } finally {
      await pointer.realMouseUp()
    }
  })

  test('AH26: пока ячейка в правке, высота строки держится; после сохранения строка перемеряется', async () => {
    let saved = ''
    const data = makeRows(20, i => (i === 0 ? 4 : 1))
    await render(
      <Host
        data={data}
        defs={{ note: { autoHeight: true } }}
        plugins={[
          cellEditing({
            canEditCell: () => true,
            onCellEdit: ({ value }: { value: unknown }) => {
              saved = String(value)
            },
          } as never),
        ]}
      />,
    )
    await waitForGrid()
    await expect.poll(() => heightOf(rowOf('0'))).toBeGreaterThan(ROW_HEIGHT)
    const tall = heightOf(rowOf('0'))
    await revealCellButtons(cellOf('0', 'note')!)
    await humanClick(
      cellOf('0', 'note')!.querySelector<HTMLElement>('.cell__button button')!,
    )
    const input = () => cellOf('0', 'note')?.querySelector('input')
    await expect.poll(input).not.toBeNull()
    await frames(3)
    expect(heightOf(rowOf('0'))).toBe(tall)
    await userEvent.clear(input()!)
    await userEvent.type(input()!, 'short{Enter}')
    await expect.poll(() => saved).toBe('short')
    setData(data.map(row => (row.id === '0' ? { ...row, note: 'short' } : row)))
    await expect.poll(() => heightOf(rowOf('0'))).toBe(ROW_HEIGHT)
  })
  // Этап 3: шапка.

  test('AH27: wrapHeaderText переносит подпись заголовка; без autoHeaderHeight она остаётся в высоте headerHeight с … и тултипом', async () => {
    const LONG = `Note ${text(8)}`
    await render(
      <Host
        data={makeRows(20, () => 1)}
        defs={{ note: { header: LONG, wrapHeaderText: true } }}
        options={{ headerHeight: 72 }}
      />,
    )
    await waitForGrid()
    const head = headCellOf('note')
    const title = head.querySelector<HTMLElement>(
      '.data-grid__cell-wrapper-title',
    )!
    expect(getComputedStyle(title).whiteSpace).toBe('normal')
    // 72px без отступов 8px — 3 целые строки, последняя с «…».
    expect(heightOf(title)).toBe(3 * LINE_HEIGHT)
    expect(title.scrollHeight).toBeGreaterThan(title.clientHeight)
    expect(heightOf(document.querySelector('.data-grid__head'))).toBe(72)
    await userEvent.hover(title)
    await expect
      .poll(() => openTips().some(tip => tip.includes(LONG)), { timeout: 2000 })
      .toBe(true)
  })

  test('AH28: autoHeaderHeight — высота уровня шапки по всем его листьям, включая колонки вне окна; горизонтальная прокрутка её не меняет', async () => {
    const columns = Array.from({ length: 60 }, (_, i) => ({
      id: `c${i}`,
      accessorFn: () => `v${i}`,
      header: i === 50 ? `Far ${text(4)}` : `C${i}`,
      size: 160,
      autoHeaderHeight: true,
    }))
    const Wide = () => {
      const created = useCreateTable({
        columns: columns as never,
        data: makeRows(20, () => 1),
        getRowId: (row: Row) => row.id,
        plugins: [textWrap()] as never,
      })
      return (
        <div style={{ width: 640, height: 520 }}>
          <DataGrid table={created as never} height={500} />
        </div>
      )
    }
    await render(<Wide />)
    await waitForGrid()
    // Заголовок далеко за окном — в шапке, и шапка по нему.
    expect(headCellOf('c50')).not.toBeNull()
    expect(
      document.querySelector('.data-grid__body-cell[data-column-id="c50"]'),
    ).toBeNull()
    const far = headCellOf('c50').querySelector<HTMLElement>(
      '.data-grid__cell-wrapper-content',
    )!
    await expect
      .poll(() => heightOf(document.querySelector('.data-grid__head')))
      .toBe(heightOf(far))
    expect(heightOf(far)).toBeGreaterThan(ROW_HEIGHT)
    const head = heightOf(document.querySelector('.data-grid__head'))
    for (const left of [3000, 8000, scroller().scrollWidth]) {
      scroller().scrollLeft = left
      await frames(3)
      expect(heightOf(document.querySelector('.data-grid__head'))).toBe(head)
    }
  })

  test('AH29: во вложенной шапке у каждого уровня своя высота, растянутый лист занимает сумму высот своих уровней, кнопки заголовка — в своей ячейке', async () => {
    const Nested = ({
      extra,
      info = `Info ${text(2)}`,
      note = `Note ${text(4)}`,
      headerMaxLines,
    }: {
      extra: string
      info?: string
      note?: string
      headerMaxLines?: number
    }) => {
      const created = useCreateTable({
        columns: [
          {
            id: 'info',
            header: info,
            autoHeaderHeight: true,
            columns: [
              { id: 'name', accessorKey: 'name', header: 'Name', size: 160 },
              {
                id: 'note',
                accessorKey: 'note',
                header: note,
                size: 160,
                autoHeaderHeight: true,
              },
            ],
          },
          {
            id: 'extra',
            accessorKey: 'extra',
            header: extra,
            size: 160,
            autoHeaderHeight: true,
          },
        ] as never,
        data: makeRows(20, () => 1),
        getRowId: (row: Row) => row.id,
        plugins: [
          columnSortingModel(),
          columnSorting(),
          textWrap({ headerMaxLines }),
        ] as never,
      })
      return (
        <div style={{ width: 600, height: 520 }}>
          <DataGrid table={created as never} height={500} />
        </div>
      )
    }
    const view = await render(<Nested extra="Extra" />)
    await waitForGrid()
    const rows = () => [
      ...document.querySelectorAll<HTMLElement>('.data-grid__head-row'),
    ]
    const wrapper = (id: string) =>
      headCellOf(id).querySelector<HTMLElement>(
        '.data-grid__cell-wrapper-content',
      )!
    await expect.poll(() => heightOf(rows()[1])).toBe(heightOf(wrapper('note')))
    // Уровень группы — по подписи группы, уровень листьев — по своей подписи; они разные.
    expect(heightOf(rows()[0])).toBe(heightOf(wrapper('info')) + 1)
    expect(heightOf(rows()[0])).not.toBe(heightOf(rows()[1]) + 1)
    // Растянутый лист — во всю высоту шапки.
    expect(heightOf(headCellOf('extra'))).toBe(
      heightOf(rows()[0]) + heightOf(rows()[1]),
    )
    expect(heightOf(document.querySelector('.data-grid__head'))).toBe(
      heightOf(rows()[0]) + heightOf(rows()[1]),
    )
    // Кнопки заголовка — в границах своей ячейки.
    for (const id of ['name', 'note', 'extra']) {
      const cell = headCellOf(id).getBoundingClientRect()
      for (const button of headCellOf(id).querySelectorAll('button')) {
        const box = button.getBoundingClientRect()
        if (box.height === 0) continue
        expect(box.top).toBeGreaterThanOrEqual(cell.top - 0.5)
        expect(box.bottom).toBeLessThanOrEqual(cell.bottom + 0.5)
      }
    }
    await view.unmount()

    // Растянутый лист выше двух уровней — нижний уровень добирает недостающее.
    await render(
      <Nested
        extra={`Extra ${text(8)}`}
        info="Info"
        note="Note"
        headerMaxLines={10}
      />,
    )
    await waitForGrid()
    await expect
      .poll(() => heightOf(headCellOf('extra')))
      .toBe(heightOf(wrapper('extra')))
    expect(heightOf(headCellOf('extra'))).toBe(
      heightOf(rows()[0]) + heightOf(rows()[1]),
    )
    expect(heightOf(rows()[0])).toBe(heightOf(wrapper('info')) + 1)
  })

  test('AH30: предел строк шапки headerMaxLines (по умолчанию 3) — дальше … с тултипом; протяжка ширины перемеряет шапку и строки по ходу', async () => {
    const LONG = `Note ${text(12)}`
    const view = await render(
      <Host
        data={makeRows(20, () => 1)}
        defs={{ note: { header: LONG, autoHeaderHeight: true } }}
      />,
    )
    await waitForGrid()
    const title = () =>
      headCellOf('note').querySelector<HTMLElement>(
        '.data-grid__cell-wrapper-title',
      )!
    await expect.poll(() => heightOf(title())).toBe(3 * LINE_HEIGHT)
    expect(title().scrollHeight).toBeGreaterThan(title().clientHeight)
    await userEvent.hover(title())
    await expect
      .poll(() => openTips().some(tip => tip.includes(LONG)), { timeout: 2000 })
      .toBe(true)
    await view.unmount()

    await render(
      <Host
        data={makeRows(20, i => (i === 0 ? 2 : 1))}
        defs={{
          note: {
            header: `Note ${text(2)}`,
            autoHeaderHeight: true,
            autoHeight: true,
          },
        }}
        plugin={{ headerMaxLines: 6 }}
        plugins={[columnSizing()]}
      />,
    )
    await waitForGrid()
    const head = () => heightOf(document.querySelector('.data-grid__head'))
    await frames(3)
    const wideHead = head()
    const wideRow = heightOf(rowOf('0'))
    // Протяжка грипа влево: посреди протяжки шапка и строка уже выше.
    const cell = headCellOf('note')
    await userEvent.hover(cell)
    const grip = cell.querySelector<HTMLElement>('[role="separator"]')!
    await expect
      .poll(() => grip.checkVisibility({ opacityProperty: true }))
      .toBe(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    const box = grip.getBoundingClientRect()
    const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    const pointer = commands as unknown as {
      realDragHold: (from: object, to: object) => Promise<void>
      realMouseUp: () => Promise<void>
    }
    await pointer.realDragHold(from, { x: from.x - 150, y: from.y })
    try {
      await expect.poll(head).toBeGreaterThan(wideHead)
      await expect.poll(() => heightOf(rowOf('0'))).toBeGreaterThan(wideRow)
      expect(
        document.querySelector('[data-column-resizing="true"]'),
      ).not.toBeNull()
    } finally {
      await pointer.realMouseUp()
    }
  })
  // Этап 4: доступность.

  test('AH31: axe с color-contrast в обеих темах — перенесённый, обрезанный и выросший текст тела и шапки, в ролях table, grid и treegrid', async () => {
    const defs = {
      name: {
        wrapText: true,
        header: `Client ${text(3)}`,
        wrapHeaderText: true,
      },
      note: {
        autoHeight: { maxLines: 3 },
        header: `Note ${text(4)}`,
        autoHeaderHeight: true,
      },
    }
    const data = makeRows(30, i => (i % 3 === 0 ? 8 : 2)).map(row => ({
      ...row,
      name: `${row.name} ${text(3)}`,
    }))
    for (const [role, options, plugins] of [
      ['table', {}, []],
      ['grid', { enableKeyboardNavigation: true }, []],
      [
        'treegrid',
        { enableKeyboardNavigation: true },
        [
          rowGroupingModel({ initialGrouping: ['group'] }),
          rowExpandingModel({ initialExpanded: true }),
          rowGrouping(),
        ],
      ],
    ] as const) {
      const view = await render(
        <Host
          data={data}
          defs={defs}
          options={options}
          plugins={[...plugins]}
        />,
      )
      await waitForGrid()
      const root = document.querySelector<HTMLElement>(`[role="${role}"]`)!
      expect(root).not.toBeNull()
      // Выросшая строка, обрезанный текст в высоте строки и перенесённая шапка — на месте.
      await expect
        .poll(() =>
          mountedRows().some(
            row =>
              row.dataset.groupRow !== 'true' && heightOf(row) > ROW_HEIGHT,
          ),
        )
        .toBe(true)
      expect(document.querySelector('[data-text-wrap="clamp"]')).not.toBeNull()
      expect(
        document.querySelector('.data-grid__head-cell[data-text-wrap="auto"]'),
      ).not.toBeNull()
      await inBothThemes(async () => {
        const { violations } = await axe.run(root, {
          ...AXE_OPTIONS,
          rules: { ...AXE_OPTIONS.rules, 'color-contrast': { enabled: true } },
        })
        expect(violations, role).toEqual([])
      })
      await view.unmount()
    }
  })
})
