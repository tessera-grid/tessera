import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, test } from 'vitest'

import '../../../core/themeVariables/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFilteringModel,
  columnPinning,
  columnSortingModel,
  keyboardNavigation,
  quickSearchModel,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { humanClick } from '../helpers'

// Серверная модель строк на гриде (ADR 0138, этап 2): высота на весь итог, скелеты
// незагруженных строк, блоки по окну прокрутки, неизвестный итог, отказы блока и списка.

interface Item {
  id: string
  name: string
  city: string
}

const COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City', filter: 'text' },
]
const NO_DATA: Item[] = []
const BLOCK = 100

const itemAt = (index: number): Item => ({
  id: `r${index}`,
  name: `N${index}`,
  city: `C${index % 7}`,
})
const rowsOf = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, i) => itemAt(start + i))

type Answer = ServerRowsResponse<Item> | Error

interface Call {
  request: ServerRowsRequest
  fast: boolean
  settle: (answer: Answer) => void
}

/**
 * «Сервер» по команде теста: `reply` решает, ответить сразу (ответ или ошибка) или ждать
 * (`undefined`) — тогда ответ приходит из `call.settle`.
 */
const server = (reply: (request: ServerRowsRequest) => Answer | undefined) => {
  const calls: Call[] = []
  const getRows = (request: ServerRowsRequest) => {
    const fast =
      document
        .querySelector('.data-grid__container')
        ?.hasAttribute('data-fast-scrolling') ?? false
    return new Promise<ServerRowsResponse<Item>>((resolve, reject) => {
      const settle = (answer: Answer) =>
        answer instanceof Error ? reject(answer) : resolve(answer)
      calls.push({ request, fast, settle })
      const now = reply(request)
      if (now) settle(now)
    })
  }
  return { calls, getRows, starts: () => calls.map(call => call.request.start) }
}

const Grid = ({
  getRows,
  rowCount,
  plugins = [],
  state,
}: {
  getRows: ReturnType<typeof server>['getRows']
  rowCount?: number
  plugins?: readonly TesseraFeatureEntry[]
  state?: Record<string, unknown>
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    state: state as never,
    plugins: [
      serverRowModel({ getRows, rowCount, blockSize: BLOCK }),
      ...plugins,
    ] as never,
  })
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const q = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)
const scroller = () => q('.data-grid__container')!
const body = () => q('.data-grid__body')!
const nextFrame = () => new Promise(requestAnimationFrame)
const rowHeight = () =>
  Number.parseFloat(
    getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
  )
/** Индексы строк тела с данными. */
const shownIndexes = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.data-grid__body-row[data-index]',
    ),
  ]
    .filter(row => row.dataset.rowId)
    .map(row => Number(row.dataset.index))
    .sort((a, b) => a - b)
const skeletonRows = () => [
  ...document.querySelectorAll<HTMLElement>('.data-grid__body-row--skeleton'),
]
const rowAt = (index: number) =>
  q(`.data-grid__body-row[data-index="${index}"]`)
const errorRow = () => q('[data-testid="rows-load-error"]')
const liveRegion = () => q('[role="status"][aria-live="polite"]')!
/** Прокрутить тело к строке `index` и дождаться, пока быстрая прокрутка уляжется. */
const scrollToIndex = async (index: number) => {
  scroller().scrollTop = index * rowHeight()
  await nextFrame()
  await expect
    .poll(() => scroller().hasAttribute('data-fast-scrolling'), {
      timeout: 3000,
    })
    .toBe(false)
}

describe('Серверная модель строк (ADR 0138)', () => {
  test('SD3: с известным rowCount тело — на весь итог с первого кадра; незагруженные строки — статичные строки скелета с закреплёнными и служебными колонками', async () => {
    const { getRows } = server(({ start, end }) =>
      start === 0 ? { rows: rowsOf(start, end) } : undefined,
    )
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={100_000}
        plugins={[columnPinning(), rowSelection()]}
        state={{ columnPinning: { start: ['name'], end: [] } }}
      />,
    )
    try {
      // Первый кадр: высота на весь итог, данных ещё может не быть.
      expect(body().getBoundingClientRect().height).toBeCloseTo(
        100_000 * rowHeight(),
        -1,
      )
      await scrollToIndex(5000)
      await expect.poll(() => skeletonRows().length).toBeGreaterThan(3)
      const row = skeletonRows()[0]!
      const cells = [
        ...row.querySelectorAll<HTMLElement>('.data-grid__body-cell--skeleton'),
      ]
      // Ячейка на каждую колонку, включая служебную колонку выбора; в пользовательских —
      // полоска; закреплённая — липкая.
      const leaves = document.querySelectorAll('.data-grid__head-cell').length
      expect(cells.length).toBe(leaves)
      expect(
        cells.filter(cell => cell.querySelector('[class*="skeleton"]')).length,
      ).toBeGreaterThanOrEqual(COLUMNS.length)
      expect(
        cells.some(cell => getComputedStyle(cell).position === 'sticky'),
      ).toBe(true)
      // Статичные: без бегущей волны.
      expect(row.getAnimations({ subtree: true })).toEqual([])
    } finally {
      await screen.unmount()
    }
  })

  test('SD4: getRows получает start, end, sorting, columnFilters, globalFilter и signal; ответ встаёт на место скелета без сдвига прокрутки и фокуса', async () => {
    const { calls, getRows } = server(({ start, end }) =>
      start === 0 ? { rows: rowsOf(start, end) } : undefined,
    )
    const sorting = [{ id: 'name', desc: true }]
    const columnFilters = [
      { id: 'city', value: { operator: 'contains', value: 'C' } },
    ]
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={10_000}
        plugins={[
          columnSortingModel({ initialSorting: sorting } as never),
          columnFilteringModel({
            initialColumnFilters: columnFilters,
          } as never),
          quickSearchModel({ initialGlobalFilter: 'N' } as never),
          keyboardNavigation(),
        ]}
      />,
    )
    try {
      await expect.poll(shownIndexes).toContain(0)
      expect(calls[0]!.request).toMatchObject({
        start: 0,
        end: BLOCK,
        sorting,
        columnFilters,
        globalFilter: 'N',
      })
      expect(calls[0]!.request.signal).toBeInstanceOf(AbortSignal)

      // Фокус на строке 90; ниже, в окне, — скелеты следующего блока.
      scroller().scrollTop = 80 * rowHeight()
      await expect.poll(() => rowAt(90)?.dataset.rowId).toBe('r90')
      const cell = rowAt(90)!.querySelector<HTMLElement>(
        '.data-grid__body-cell',
      )!
      await humanClick(cell)
      await expect.poll(() => document.activeElement).toBe(cell)
      await expect
        .poll(() => calls.some(call => call.request.start === BLOCK))
        .toBe(true)
      expect(rowAt(BLOCK)?.dataset.rowId).toBeUndefined()
      const top = scroller().scrollTop

      calls
        .find(call => call.request.start === BLOCK)!
        .settle({
          rows: rowsOf(BLOCK, 2 * BLOCK),
        })
      await expect.poll(() => rowAt(BLOCK)?.dataset.rowId).toBe(`r${BLOCK}`)
      expect(rowAt(BLOCK)!.textContent).toContain(`N${BLOCK}`)
      expect(scroller().scrollTop).toBe(top)
      expect(document.activeElement).toBe(cell)
    } finally {
      await screen.unmount()
    }
  })

  test('SD5: прыжок ползунком в середину списка запрашивает только блоки нового окна', async () => {
    const { calls, getRows, starts } = server(({ start, end }) => ({
      rows: rowsOf(start, end),
    }))
    const screen = await render(<Grid getRows={getRows} rowCount={100_000} />)
    try {
      await expect.poll(shownIndexes).toContain(0)
      expect(starts()).toEqual([0])
      await scrollToIndex(50_000)
      await expect.poll(() => shownIndexes().length).toBeGreaterThan(3)
      const blocks = new Set(
        shownIndexes().map(index => Math.floor(index / BLOCK) * BLOCK),
      )
      expect(blocks.has(50_000)).toBe(true)
      expect(
        starts()
          .slice(1)
          .every(start => blocks.has(start)),
      ).toBe(true)
      expect(calls.length).toBeLessThanOrEqual(1 + blocks.size)
    } finally {
      await screen.unmount()
    }
  })

  test('SD10: без итога высота растёт по блокам; короткий блок — конец списка; новый итог не сдвигает прокрутку и фокус', async () => {
    const LAST = 340
    const { getRows } = server(({ start, end }) => ({
      rows: rowsOf(start, Math.min(end, LAST)),
    }))
    const screen = await render(
      <Grid getRows={getRows} plugins={[keyboardNavigation()]} />,
    )
    try {
      await expect.poll(shownIndexes).toContain(0)
      // Загружен блок — впереди ещё один блок скелета.
      expect(body().getBoundingClientRect().height).toBeCloseTo(
        2 * BLOCK * rowHeight(),
        -1,
      )
      const cell = rowAt(2)!.querySelector<HTMLElement>(
        '.data-grid__body-cell',
      )!
      await humanClick(cell)
      await expect.poll(() => document.activeElement).toBe(cell)
      // Листаем вниз, пока список не кончится коротким блоком.
      for (let i = 0; i < 8; i++) {
        scroller().scrollTop = scroller().scrollHeight
        await nextFrame()
        await expect
          .poll(() => scroller().hasAttribute('data-fast-scrolling'), {
            timeout: 3000,
          })
          .toBe(false)
      }
      await expect
        .poll(() => body().getBoundingClientRect().height)
        .toBeCloseTo(LAST * rowHeight(), -1)
      await expect.poll(shownIndexes).toContain(LAST - 1)
      expect(skeletonRows()).toEqual([])
      // Рост итога не трогал прокрутку у верха и фокус на строке 2 (держится в окне).
      expect(document.activeElement).toBe(cell)
    } finally {
      await screen.unmount()
    }
  })

  test('SD11: отказ блока — строка ошибки с причиной у верха видимой части блока, повтор перезапрашивает только его; плашки нет; отказ объявлен', async () => {
    let refuse = true
    const { calls, getRows, starts } = server(({ start, end }) =>
      start === BLOCK && refuse
        ? new Error('down')
        : { rows: rowsOf(start, end) },
    )
    const screen = await render(<Grid getRows={getRows} rowCount={1000} />)
    try {
      await expect.poll(shownIndexes).toContain(0)
      await scrollToIndex(BLOCK + 20)
      await expect.poll(errorRow).not.toBeNull()
      expect(errorRow()!.textContent).toContain('down')
      // У верха видимой части блока: сразу под шапкой.
      const head = q('.data-grid__head')!.getBoundingClientRect()
      // Допуск — рамка строки ошибки сверху.
      expect(
        Math.abs(errorRow()!.getBoundingClientRect().top - head.bottom),
      ).toBeLessThan(2)
      // Строк блока под ней нет — ни данных, ни скелетов.
      expect(rowAt(BLOCK + 20)).toBeNull()
      expect(q('[data-testid="load-error-banner"]')).toBeNull()
      await expect.poll(() => liveRegion().textContent).toContain('down')

      refuse = false
      const before = calls.length
      await userEvent.click(errorRow()!.querySelector('button')!)
      await expect
        .poll(() => rowAt(BLOCK + 20)?.dataset.rowId)
        .toBe(`r${BLOCK + 20}`)
      expect(starts().slice(before)).toEqual([BLOCK])
      expect(errorRow()).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SD12: отказ первого запроса при пустом кэше — заглушка ошибки ADR 0096, повтор перезапрашивает', async () => {
    let refuse = true
    const { getRows, starts } = server(({ start, end }) =>
      refuse ? new Error('offline') : { rows: rowsOf(start, end) },
    )
    const screen = await render(<Grid getRows={getRows} rowCount={1000} />)
    try {
      await expect
        .poll(() => q('[data-testid="load-error-stub"]'))
        .not.toBeNull()
      expect(q('[data-testid="load-error-stub"]')!.textContent).toContain(
        'offline',
      )
      expect(errorRow()).toBeNull()

      refuse = false
      await userEvent.click(q('[data-testid="load-error-retry"]')!)
      await expect.poll(shownIndexes).toContain(0)
      expect(starts()).toEqual([0, 0])
      expect(q('[data-testid="load-error-stub"]')).toBeNull()
    } finally {
      await screen.unmount()
    }
  })

  test('SD6: во время быстрой прокрутки блоки не запрашиваются; после неё — блоки окна', async () => {
    const { calls, getRows, starts } = server(({ start, end }) => ({
      rows: rowsOf(start, end),
    }))
    const screen = await render(<Grid getRows={getRows} rowCount={100_000} />)
    try {
      await expect.poll(shownIndexes).toContain(0)
      expect(starts()).toEqual([0])

      // Рывок далеко вниз: быстрее порога входа (2000 px/s) — сотни строк за кадр.
      const el = scroller()
      for (let i = 0; i < 12; i++) {
        el.scrollTop += 3000
        await nextFrame()
      }
      expect(el.hasAttribute('data-fast-scrolling')).toBe(true)
      expect(calls.filter(call => call.fast)).toEqual([])
      expect(starts()).toEqual([0])

      // Прокрутка улеглась — запрошены блоки нового окна, промежуточные — нет.
      await expect
        .poll(() => el.hasAttribute('data-fast-scrolling'), { timeout: 3000 })
        .toBe(false)
      await expect.poll(() => shownIndexes().length).toBeGreaterThan(3)
      const shown = shownIndexes()
      const windowBlocks = new Set(
        shown.map(index => Math.floor(index / BLOCK) * BLOCK),
      )
      const after = starts().slice(1)
      expect(after.length).toBeGreaterThan(0)
      expect(after.every(start => windowBlocks.has(start))).toBe(true)
      expect(shown[0]).toBeGreaterThan(BLOCK * 3)
    } finally {
      await screen.unmount()
    }
  })
})
