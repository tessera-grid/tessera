import axe from 'axe-core'
import { render } from 'vitest-browser-react'
import { commands, userEvent } from 'vitest/browser'
import { describe, expect, test, vi } from 'vitest'

import '../../../core/themeVariables/theme.css'
import type { TesseraFeatureEntry } from '../../../core/features'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  cellSelection,
  cellSelectionModel,
  columnFilteringModel,
  columnPinning,
  columnSorting,
  infiniteScroll,
  pagination,
  rowDragging,
  rowGrouping,
  columnSortingModel,
  keyboardNavigation,
  quickSearchModel,
  rowExpanding,
  rowSelection,
  serverRowModel,
  type ServerRowsRequest,
  type ServerRowsResponse,
} from '../../../plugins'
import { BodyRow } from '../../../grid/BodyRow'
import { setColumnFilterByUser, setSearchByUser } from '../../../core/filtering'
import { humanClick, revealCellButtons } from '../helpers'
import { tableLabels } from '../labels'
import { measureWork, renders } from '../work.helpers'
import { AXE_OPTIONS, contrast, effectiveBg, toRgba } from './a11y-helpers'

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
  /** Тест уже ответил на запрос. */
  done?: boolean
}

/** Таблица стенда: смена выборки из теста. */
interface QueryTable {
  setColumnFilters: (filters: { id: string; value: unknown }[]) => void
  setGlobalFilter: (value: string) => void
  store: { get: () => Record<string, unknown> }
  getPluginDiagnostics: () => unknown[]
  scrollToRowIndex: (
    index: number,
    options?: { align?: 'auto' | 'start' | 'center' | 'end' },
  ) => Promise<boolean>
  scrollToRow: (
    id: string,
    options?: { index?: number; align?: 'auto' | 'start' | 'center' | 'end' },
  ) => Promise<boolean>
}

/** Строки выборки: префикс id — по ней (сортировка по возрастанию и убыванию, фильтр, поиск). */
/** Условие фильтра колонки города. */
const CITY_FILTER = { operator: 'contains', value: 'C1' }

const tagOf = ({ sorting, columnFilters, globalFilter }: ServerRowsRequest) =>
  globalFilter
    ? 'g'
    : columnFilters.length > 0
      ? 'f'
      : sorting[0]?.desc
        ? 'd'
        : sorting.length > 0
          ? 's'
          : 'r'
const queryRows = (request: ServerRowsRequest): ServerRowsResponse<Item> => ({
  rows: Array.from({ length: request.end - request.start }, (_, k) => ({
    ...itemAt(request.start + k),
    id: `${tagOf(request)}${request.start + k}`,
  })),
})

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
  colorMode,
  onTable,
  maxBlocks,
}: {
  getRows: ReturnType<typeof server>['getRows']
  rowCount?: number
  plugins?: readonly TesseraFeatureEntry[]
  state?: Record<string, unknown>
  colorMode?: 'light' | 'dark'
  onTable?: (table: QueryTable) => void
  maxBlocks?: number
}) => {
  const table = useCreateTable({
    columns: COLUMNS as never,
    data: NO_DATA,
    getRowId: (row: Item) => row.id,
    state: state as never,
    // Свечение обновления сразу, без задержки показа (ADR 0094).
    refreshOptions: { delayMs: 0, minDurationMs: 0 },
    plugins: [
      serverRowModel({ getRows, rowCount, blockSize: BLOCK, maxBlocks }),
      ...plugins,
    ] as never,
  })
  onTable?.(table as unknown as QueryTable)
  return (
    <div style={{ width: 600, height: 420 }}>
      <DataGrid table={table as never} colorMode={colorMode} />
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
const pendingRow = (index: number) =>
  q(`[data-pending-row][data-index="${index}"]`)
const press = (keys: string) => userEvent.keyboard(keys)
/** Настоящая мышь Playwright. */
const pointer = commands as unknown as {
  realDragHold: (from: object, to: object, steps?: number) => Promise<void>
  realMouseUp: () => Promise<void>
}
const glowing = () => !!q('[data-refreshing]')
const sortButton = () =>
  q('.data-grid__head-cell[data-column-id="name"] .column-sort__button')
const ariaSort = () =>
  q(
    '.data-grid__head-cell[data-column-id="name"][aria-colindex]',
  )!.getAttribute('aria-sort')
const banner = () => q('[data-testid="load-error-banner"]')
const retryButton = () => q('[data-testid="load-error-retry"]')!
const lit = (element: Element | null) =>
  element?.getAttribute('aria-busy') === 'true' &&
  element.hasAttribute('data-pending')
/** Строка, в которой фокус: индекс в списке. */
const focusedIndex = () =>
  Number(
    (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
      '[data-index]',
    )?.dataset.index ?? -1,
  )
/** Нажать на ячейку строки `index` (строка в окне) и дождаться фокуса. */
const focusRow = async (index: number) => {
  await expect.poll(() => rowAt(index)?.dataset.rowId).toBe(`r${index}`)
  const cell = rowAt(index)!.querySelector<HTMLElement>('[data-kn-cell]')!
  await humanClick(cell)
  await expect.poll(() => document.activeElement).toBe(cell)
  return cell
}
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

  test('SD11: отказ блока — строка ошибки с причиной у верха видимой части блока, под ней строки блока — пустые рамки строк без полосок скелета, повтор перезапрашивает только его; плашки нет; отказ объявлен', async () => {
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
      // Строки блока под ней — пустые рамки: ячейки колонок без полосок скелета,
      // скрытые от вспомогательных технологий; ни данных, ни скелетов.
      expect(rowAt(BLOCK + 20)).toBeNull()
      const frame = q(`[data-failed-row][data-index="${BLOCK + 20}"]`)!
      expect(frame).not.toBeNull()
      expect(
        [...frame.querySelectorAll<HTMLElement>('[data-column-id]')].map(
          cell => cell.dataset.columnId,
        ),
      ).toEqual(['name', 'city'])
      expect(frame.querySelectorAll('span')).toHaveLength(0)
      expect(frame.querySelector('[aria-hidden="true"]')).not.toBeNull()
      expect(frame.getBoundingClientRect().height).toBe(rowHeight())
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

  test('SD14: активная ячейка на незагруженной строке — фокус стоит, строка aria-busy, блок приходит без сдвига фокуса; с enableKeyboardNavigation вкл и выкл', async () => {
    const { calls, getRows } = server(({ start, end }) =>
      start === 0 ? { rows: rowsOf(start, end) } : undefined,
    )
    let screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        plugins={[keyboardNavigation()]}
      />,
    )
    try {
      await scrollToIndex(90)
      const cell = await focusRow(98)
      const column = cell.dataset.columnId
      await press('{ArrowDown}{ArrowDown}{ArrowDown}')
      await expect.poll(focusedIndex).toBe(101)
      const row = pendingRow(101)!
      expect(row.contains(document.activeElement)).toBe(true)
      expect(row.getAttribute('aria-busy')).toBe('true')
      expect(row.getAttribute('role')).toBe('row')

      // Блок пришёл — фокус в той же строке и колонке, уже на настоящей ячейке.
      await expect
        .poll(() => calls.some(call => call.request.start === BLOCK))
        .toBe(true)
      calls
        .find(call => call.request.start === BLOCK)!
        .settle({ rows: rowsOf(BLOCK, 2 * BLOCK) })
      await expect.poll(() => rowAt(101)?.dataset.rowId).toBe('r101')
      await expect
        .poll(() => rowAt(101)!.contains(document.activeElement))
        .toBe(true)
      expect((document.activeElement as HTMLElement).dataset.columnId).toBe(
        column,
      )
    } finally {
      await screen.unmount()
    }

    // Без клавиатурной навигации: строка-заглушка не фокусируется и фокус не трогает.
    const off = server(({ start, end }) =>
      start === 0 ? { rows: rowsOf(start, end) } : undefined,
    )
    screen = await render(<Grid getRows={off.getRows} rowCount={1000} />)
    try {
      await scrollToIndex(90)
      await expect.poll(() => pendingRow(101)).not.toBeNull()
      const cell = pendingRow(101)!.querySelector('[role="cell"]')!
      expect(cell.hasAttribute('tabindex')).toBe(false)
      const focused = document.activeElement
      off.calls
        .find(call => call.request.start === BLOCK)!
        .settle({ rows: rowsOf(BLOCK, 2 * BLOCK) })
      await expect.poll(() => rowAt(101)?.dataset.rowId).toBe('r101')
      expect(document.activeElement).toBe(focused)
    } finally {
      await screen.unmount()
    }
  })

  test('SD15: Ctrl+End, Ctrl+Home, PageDown и PageUp двигают по всему итогу и загружают нужный блок', async () => {
    const { getRows, starts } = server(({ start, end }) => ({
      rows: rowsOf(start, end),
    }))
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        plugins={[keyboardNavigation()]}
      />,
    )
    try {
      await focusRow(0)
      await press('{Control>}{End}{/Control}')
      await expect.poll(focusedIndex).toBe(999)
      await expect.poll(() => rowAt(999)?.dataset.rowId).toBe('r999')
      expect(starts()).toContain(900)
      await expect
        .poll(() => rowAt(999)!.contains(document.activeElement))
        .toBe(true)

      // Ctrl+Home — в первую ячейку шапки (KN5); ↓ оттуда — первая строка списка.
      await press('{Control>}{Home}{/Control}')
      await expect
        .poll(() => document.activeElement?.getAttribute('role'))
        .toBe('columnheader')
      await press('{ArrowDown}')
      await expect.poll(focusedIndex).toBe(0)
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')

      // PageDown от конца первого блока уводит во второй — он приходит, фокус на строке.
      await scrollToIndex(90)
      await focusRow(97)
      await press('{PageDown}')
      await expect.poll(focusedIndex).toBeGreaterThan(BLOCK)
      const down = focusedIndex()
      await expect.poll(() => rowAt(down)?.dataset.rowId).toBe(`r${down}`)
      expect(starts()).toContain(BLOCK)
      await press('{PageUp}')
      await expect.poll(focusedIndex).toBeLessThan(down)
    } finally {
      await screen.unmount()
    }
  })

  test('SD16: aria-rowcount — итог с шапкой или -1; незагруженные строки — role="row" со сквозным aria-rowindex и aria-busy; в ролях table и grid', async () => {
    for (const plugins of [[], [keyboardNavigation()]]) {
      const role = plugins.length ? 'grid' : 'table'
      const { getRows } = server(({ start, end }) =>
        start === 0 ? { rows: rowsOf(start, end) } : undefined,
      )
      const screen = await render(
        <Grid getRows={getRows} rowCount={1000} plugins={plugins} />,
      )
      try {
        const root = q(`[role="${role}"]`)!
        await expect.poll(shownIndexes).toContain(0)
        expect(root.getAttribute('aria-rowcount')).toBe('1001')
        await scrollToIndex(BLOCK + 10)
        await expect.poll(() => pendingRow(BLOCK + 10)).not.toBeNull()
        const rows = [
          ...document.querySelectorAll<HTMLElement>('[data-pending-row]'),
        ].sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
        for (const row of rows) {
          expect(row.getAttribute('role')).toBe('row')
          expect(row.getAttribute('aria-busy')).toBe('true')
          expect(row.getAttribute('aria-rowindex')).toBe(
            String(Number(row.dataset.index) + 2),
          )
          expect(row.closest('[aria-hidden="true"]')).toBeNull()
        }
      } finally {
        await screen.unmount()
      }
    }

    // Итог неизвестен — -1, пока короткий блок не закончил список.
    const LAST = 140
    const { getRows } = server(({ start, end }) => ({
      rows: rowsOf(start, Math.min(end, LAST)),
    }))
    const screen = await render(<Grid getRows={getRows} />)
    try {
      await expect.poll(shownIndexes).toContain(0)
      expect(q('[role="table"]')!.getAttribute('aria-rowcount')).toBe('-1')
      await scrollToIndex(LAST)
      await expect
        .poll(() => q('[role="table"]')!.getAttribute('aria-rowcount'))
        .toBe(String(LAST + 1))
    } finally {
      await screen.unmount()
    }
  })

  test('SD17: axe и color-contrast скелета, строки ошибки и ожидания в обеих темах', async () => {
    for (const colorMode of ['light', 'dark'] as const) {
      const { getRows } = server(({ start, end }) =>
        start === 0
          ? { rows: rowsOf(start, end) }
          : start === BLOCK
            ? new Error('down')
            : undefined,
      )
      const screen = await render(
        <Grid
          getRows={getRows}
          rowCount={1000}
          plugins={[keyboardNavigation()]}
          colorMode={colorMode}
        />,
      )
      try {
        await expect.poll(shownIndexes).toContain(0)
        // В окне — строки с данными, строка ошибки блока и строки-заглушки.
        await scrollToIndex(2 * BLOCK - 4)
        await expect.poll(errorRow).not.toBeNull()
        await expect.poll(() => pendingRow(2 * BLOCK + 1)).not.toBeNull()
        const { violations } = await axe.run(q('.data-grid-theme')!, {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        })
        expect(violations, colorMode).toEqual([])
        // Под липкой строкой ошибки axe фон не определяет (incomplete) — меряем сами.
        for (const text of errorRow()!.querySelectorAll<HTMLElement>(
          '[class*="error-title"], [class*="error-reason"], button',
        )) {
          const ratio = contrast(
            toRgba(getComputedStyle(text).color),
            effectiveBg(text),
          )
          expect(
            ratio,
            `${colorMode}: ${text.textContent}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      } finally {
        await screen.unmount()
      }
    }
  })

  test('SD18: список выше предела высоты браузера — dev-warn с советом о пагинации', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { getRows } = server(() => undefined)
      let screen = await render(<Grid getRows={getRows} rowCount={1000} />)
      await expect.poll(skeletonRows).not.toEqual([])
      expect(
        warn.mock.calls.some(call => String(call[0]).includes('pagination')),
      ).toBe(false)
      await screen.unmount()

      screen = await render(<Grid getRows={getRows} rowCount={10_000_000} />)
      await expect
        .poll(() =>
          warn.mock.calls.some(call => String(call[0]).includes('pagination')),
        )
        .toBe(true)
      await screen.unmount()
    } finally {
      warn.mockRestore()
    }
  })

  test('SD19: приход блока строит строки только этого блока и не перерисовывает строки других блоков', async () => {
    const { calls, getRows } = server(({ start, end }) =>
      start === 0 ? { rows: rowsOf(start, end) } : undefined,
    )
    const screen = await render(<Grid getRows={getRows} rowCount={1000} />)
    try {
      // Окно на стыке: внизу блока 0 строки с данными, ниже — скелеты блока 1.
      await scrollToIndex(BLOCK - 5)
      await expect
        .poll(() => rowAt(BLOCK - 1)?.dataset.rowId)
        .toBe(`r${BLOCK - 1}`)
      await expect
        .poll(() => calls.some(call => call.request.start === BLOCK))
        .toBe(true)
      const kept = [
        ...document.querySelectorAll<HTMLElement>(
          '.data-grid__body-row[data-row-id]',
        ),
      ]
      const work = await measureWork(scroller(), () =>
        calls
          .find(call => call.request.start === BLOCK)!
          .settle({ rows: rowsOf(BLOCK, 2 * BLOCK) }),
      )
      await expect.poll(() => rowAt(BLOCK)?.dataset.rowId).toBe(`r${BLOCK}`)
      const arrived = shownIndexes().filter(index => index >= BLOCK).length
      // Перерисованы только пришедшие строки; строки блока 0 — те же узлы.
      expect(arrived).toBeGreaterThan(0)
      expect(renders(work, BodyRow)).toBe(arrived)
      for (const row of kept) expect(row.isConnected).toBe(true)
    } finally {
      await screen.unmount()
    }
  })
  test('SD20: смена сортировки, фильтра или поиска — кэш сброшен, тело в начале, signal запросов прерван, прежние строки под свечением обновления до прихода окна', async () => {
    let hold = false
    const { calls, getRows } = server(request =>
      hold ? undefined : queryRows(request),
    )
    const tableRef: { current?: QueryTable } = {}
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        onTable={table => (tableRef.current = table)}
        plugins={[
          columnSorting({ multiSort: false }),
          columnFilteringModel(),
          quickSearchModel(),
        ]}
      />,
    )
    const pendingOf = (match: (request: ServerRowsRequest) => boolean) =>
      calls.filter(call => match(call.request) && !call.request.signal.aborted)
    /** Новая выборка: тело в начале, прежние строки под свечением, её окно в пути. */
    const changed = async (
      match: (request: ServerRowsRequest) => boolean,
      before: string,
    ) => {
      await expect.poll(() => scroller().scrollTop).toBe(0)
      await expect
        .poll(() => pendingOf(match).some(call => call.request.start === 0))
        .toBe(true)
      await expect.poll(glowing).toBe(true)
      expect(rowAt(0)?.dataset.rowId).toBe(`${before}0`)
      hold = false
      const window = pendingOf(match)
      for (const call of window) call.settle(queryRows(call.request))
      const after = tagOf(window[0]!.request)
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe(`${after}0`)
      await expect.poll(glowing).toBe(false)
      return after
    }
    try {
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')
      await scrollToIndex(500)
      await expect.poll(() => rowAt(500)?.dataset.rowId).toBe('r500')
      // Блоки у строки 800 в пути, когда выборка сменилась.
      hold = true
      await scrollToIndex(800)
      await expect
        .poll(() => pendingOf(request => request.start >= 800).length)
        .toBeGreaterThan(0)
      const inFlight = pendingOf(request => request.start >= 800)

      await userEvent.click(sortButton()!)
      const sorted = await changed(request => request.sorting.length > 0, 'r')
      for (const call of inFlight) {
        expect(call.request.signal.aborted).toBe(true)
      }
      // Кэш прежней выборки сброшен: строка 500 приходит заново под сортировкой.
      await scrollToIndex(500)
      await expect.poll(() => rowAt(500)?.dataset.rowId).toBe(`${sorted}500`)

      hold = true
      tableRef.current!.setColumnFilters([{ id: 'city', value: CITY_FILTER }])
      await changed(request => request.columnFilters.length > 0, sorted)

      hold = true
      tableRef.current!.setGlobalFilter('N')
      await changed(request => request.globalFilter === 'N', 'f')
    } finally {
      await screen.unmount()
    }
  })

  test('SD21: перезапрос после смены сортировки, фильтра или поиска — серверное действие ADR 0116: свет у причины, отказ откатывает сортировку, оставляет черновик полей и показывает плашку с повтором', async () => {
    let refuse = false
    const { calls, getRows } = server(request =>
      request.sorting.length === 0 &&
      request.columnFilters.length === 0 &&
      request.globalFilter === ''
        ? queryRows(request)
        : undefined,
    )
    const tableRef: { current?: QueryTable } = {}
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        onTable={table => (tableRef.current = table)}
        plugins={[
          columnSorting({
            multiSort: false,
            // Колбэк в этом режиме — уведомление: его промис не ждётся.
            onToggleColumnSort: () => new Promise(() => {}),
          }),
          columnFilteringModel(),
          quickSearchModel(),
        ]}
      />,
    )
    // Ответы на прежнюю выборку стенд даёт сам; в пути — запросы новой.
    const held = () =>
      calls.filter(
        call =>
          tagOf(call.request) !== 'r' &&
          !call.done &&
          !call.request.signal.aborted,
      )
    /** Ответить на окно в пути; префикс строк его выборки. */
    const answerHeld = async () => {
      await expect.poll(() => held().length).toBeGreaterThan(0)
      const window = held()
      for (const call of window) {
        call.done = true
        call.settle(refuse ? new Error('down') : queryRows(call.request))
      }
      return tagOf(window[0]!.request)
    }
    try {
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')

      // Свет у причины, пока окно новой выборки в пути; приход гасит его.
      await userEvent.click(sortButton()!)
      await expect.poll(() => lit(sortButton())).toBe(true)
      const first = await answerHeld()
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe(`${first}0`)
      await expect.poll(() => lit(sortButton())).toBe(false)
      const confirmed = ariaSort()

      // Отказ: сортировка — к подтверждённой, на экране прежние строки, плашка с причиной.
      refuse = true
      await userEvent.click(sortButton()!)
      await answerHeld()
      await expect.poll(() => banner()?.textContent ?? '').toContain('down')
      expect(ariaSort()).toBe(confirmed)
      expect(rowAt(0)?.dataset.rowId).toBe(`${first}0`)

      // Повтор плашки повторяет действие.
      refuse = false
      await userEvent.click(retryButton())
      const second = await answerHeld()
      expect(second).not.toBe(first)
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe(`${second}0`)
      expect(ariaSort()).not.toBe(confirmed)
      await expect.poll(banner).toBeNull()

      // Отказ фильтра и поиска: черновик остаётся в состоянии, строки — прежние.
      refuse = true
      setColumnFilterByUser(tableRef.current, 'city', CITY_FILTER)
      await answerHeld()
      await expect.poll(() => banner()?.textContent ?? '').toContain('down')
      expect(tableRef.current!.store.get().columnFilters).toEqual([
        { id: 'city', value: CITY_FILTER },
      ])
      expect(rowAt(0)?.dataset.rowId).toBe(`${second}0`)
      setSearchByUser(tableRef.current, 'N')
      await answerHeld()
      await expect.poll(() => banner()?.textContent ?? '').toContain('down')
      expect(tableRef.current!.store.get().globalFilter).toBe('N')
      expect(rowAt(0)?.dataset.rowId).toBe(`${second}0`)
    } finally {
      await screen.unmount()
    }
  })
  test('SD24: правка ячейки — успех onCellEdit пишет значение в кэш; блок строки в правке не вытесняется', async () => {
    const { calls, getRows } = server(({ start, end }) => ({
      rows: rowsOf(start, end),
    }))
    let save: (() => void) | undefined
    let synchronous = false
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        maxBlocks={1}
        plugins={[
          cellEditing({
            // Приложение данные не трогает: значение в ячейку пишет кэш.
            onCellEdit: () =>
              synchronous
                ? undefined
                : new Promise<void>(resolve => {
                    save = resolve
                  }),
          }),
        ]}
      />,
    )
    const nameCell = () =>
      q('.data-grid__body-row[data-index="0"] [data-column-id="name"]')
    try {
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')
      await revealCellButtons(nameCell()!)
      await humanClick(
        nameCell()!.querySelector<HTMLElement>('.cell__button button')!,
      )
      const input = await vi.waitFor(() => {
        const found = nameCell()?.querySelector<HTMLInputElement>('input')
        if (!found) throw new Error('editor not open')
        return found
      })
      await userEvent.fill(input, 'Edited')
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => save).toBeDefined()

      // Сохранение в пути: строка уходит из окна, её блок остаётся в кэше сверх предела.
      const before = calls.length
      await scrollToIndex(500)
      await expect.poll(() => rowAt(500)?.dataset.rowId).toBe('r500')
      await scrollToIndex(0)
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')
      expect(calls.slice(before).map(call => call.request.start)).not.toContain(
        0,
      )

      // Пока сохранение в пути, ячейка показывает черновик (ADR 0057): значение из кэша
      // сверяется после итога.
      expect(nameCell()!.querySelector('[aria-busy="true"]')).not.toBeNull()
      save!()
      await expect
        .poll(() => nameCell()!.querySelector('[aria-busy="true"]'))
        .toBeNull()
      expect(nameCell()?.textContent?.trim()).toBe('Edited')

      // Успех без промиса — то же: значение из кэша сразу.
      synchronous = true
      await revealCellButtons(nameCell()!)
      await humanClick(
        nameCell()!.querySelector<HTMLElement>('.cell__button button')!,
      )
      const again = await vi.waitFor(() => {
        const found = nameCell()?.querySelector<HTMLInputElement>('input')
        if (!found) throw new Error('editor not open')
        return found
      })
      await userEvent.fill(again, 'Synced')
      await userEvent.keyboard('{Enter}')
      await expect.poll(() => nameCell()?.textContent?.trim()).toBe('Synced')
    } finally {
      await screen.unmount()
    }
  })

  test('SD25: scrollToRowIndex загружает блок и прокручивает к строке; scrollToRow(id, { index }) прокручивает по подсказке и даёт false, если строка с этим id там не оказалась', async () => {
    const { calls, getRows } = server(({ start, end }) =>
      start === 0 ? { rows: rowsOf(start, end) } : undefined,
    )
    const tableRef: { current?: QueryTable } = {}
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={10_000}
        onTable={table => (tableRef.current = table)}
      />,
    )
    /** Ответить на запрос блока `start`, как только он придёт. */
    const reply = async (start: number, answer?: Answer) => {
      await expect
        .poll(() =>
          calls.some(
            call =>
              call.request.start === start && !call.request.signal.aborted,
          ),
        )
        .toBe(true)
      calls
        .filter(
          call => call.request.start === start && !call.request.signal.aborted,
        )
        .forEach(call =>
          call.settle(answer ?? { rows: rowsOf(start, start + BLOCK) }),
        )
    }
    const atTop = (index: number) => {
      const row = rowAt(index)
      const head = q('.data-grid__head')!.getBoundingClientRect()
      return (
        !!row && Math.abs(row.getBoundingClientRect().top - head.bottom) < 2
      )
    }
    try {
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')

      // Индекс: прыжок, ожидание блока, строка у верха окна.
      let settled = false
      const byIndex = tableRef.current!.scrollToRowIndex(5050, {
        align: 'start',
      })
      void byIndex.then(() => (settled = true))
      await expect
        .poll(() => calls.some(call => call.request.start === 5000))
        .toBe(true)
      await nextFrame()
      expect(settled).toBe(false)
      await reply(5000)
      expect(await byIndex).toBe(true)
      expect(atTop(5050)).toBe(true)

      // Подсказка индекса: строка с этим id там — `true`.
      const hinted = tableRef.current!.scrollToRow('r7050', {
        index: 7050,
        align: 'start',
      })
      await reply(7000)
      expect(await hinted).toBe(true)
      expect(atTop(7050)).toBe(true)

      // По подсказке пришла другая строка — `false`.
      const wrong = tableRef.current!.scrollToRow('elsewhere', {
        index: 8050,
        align: 'start',
      })
      await reply(8000)
      expect(await wrong).toBe(false)

      // Блок отказал — `false`.
      const failed = tableRef.current!.scrollToRowIndex(9050)
      await reply(9000, new Error('down'))
      expect(await failed).toBe(false)
    } finally {
      await screen.unmount()
    }
  })
  test("SD27: cellSelection и cellSelectionModel инертны с причиной 'serverRowModel' и dev-warn: выделение диапазона жестом не встаёт, копирование ничего не пишет", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getRows } = server(({ start, end }) => ({
      rows: rowsOf(start, end),
    }))
    const changed = vi.fn()
    const tableRef: { current?: QueryTable } = {}
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        onTable={table => (tableRef.current = table)}
        plugins={[cellSelection({ onCellSelectionChange: changed })]}
      />,
    )
    const cellOf = (index: number, column: string) =>
      q(
        `.data-grid__body-row[data-index="${index}"] [data-column-id="${column}"]`,
      )!
    try {
      await expect.poll(() => rowAt(3)?.dataset.rowId).toBe('r3')
      /** Причина и предупреждение плагина таблицы на экране. */
      const expectInert = (id: string) => {
        expect(tableRef.current!.getPluginDiagnostics()).toContainEqual({
          id,
          status: 'inert',
          reason: 'serverRowModel',
        })
        expect(
          warn.mock.calls.some(call =>
            call.some(
              part =>
                String(part).includes(id) &&
                String(part).includes('serverRowModel'),
            ),
          ),
        ).toBe(true)
      }
      expectInert('cellSelection')

      // Настоящая мышь: протяжка по двум колонкам и четырём строкам.
      const from = cellOf(0, 'name').getBoundingClientRect()
      const to = cellOf(3, 'city').getBoundingClientRect()
      await pointer.realDragHold(
        { x: from.left + 10, y: from.top + from.height / 2 },
        { x: to.left + 10, y: to.top + to.height / 2 },
      )
      await pointer.realMouseUp()
      await nextFrame()
      expect(changed).not.toHaveBeenCalled()
      expect(
        document.querySelectorAll('[data-cell-selected="true"]'),
      ).toHaveLength(0)

      // Копирование: грид событие не перехватывает и в буфер не пишет.
      const copy = new ClipboardEvent('copy', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      })
      cellOf(1, 'name').dispatchEvent(copy)
      expect(copy.defaultPrevented).toBe(false)
      expect(copy.clipboardData!.getData('text/plain')).toBe('')

      // Модель без интерфейса — тоже инертна.
      await screen.rerender(<></>)
      await screen.rerender(
        <Grid
          getRows={getRows}
          rowCount={1000}
          onTable={table => (tableRef.current = table)}
          plugins={[cellSelectionModel()]}
        />,
      )
      await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')
      expectInert('cellSelectionModel')
    } finally {
      warn.mockRestore()
      await screen.unmount()
    }
  })
  test('SD28: «Выбрать всё» выбирает весь итог без загрузки; снятые флажки — исключения; флажки строк живые; счётчик rowCount − исключения; срез { all, except } в onRowSelectionChange', async () => {
    const { calls, getRows } = server(({ start, end }) => ({
      rows: rowsOf(start, end),
    }))
    const changes: unknown[] = []
    const screen = await render(
      <Grid
        getRows={getRows}
        rowCount={1000}
        plugins={[
          rowSelection({
            selectedCount: true,
            onRowSelectionChange: next => changes.push(next),
          }),
        ]}
      />,
    )
    const checkbox = (index: number) =>
      rowAt(index)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
    const head = () => q('.data-grid__head-cell .row-select-checkbox')!
    const checked = (element: Element | null) =>
      !!element?.hasAttribute('data-checked')
    const count = () =>
      q('[data-testid="selected-rows-count"]')?.textContent?.trim() ?? ''
    try {
      await expect.poll(() => checkbox(0)).not.toBeNull()
      const requested = calls.length

      // Весь итог выбран, новых запросов нет.
      await userEvent.click(head())
      await expect.poll(() => changes.at(-1)).toEqual({ all: true, except: [] })
      await expect.poll(() => checked(checkbox(0))).toBe(true)
      expect(checked(head())).toBe(true)
      expect(calls.length).toBe(requested)
      await expect.poll(count).toBe(tableLabels.selectedRows(1000))

      // Строки блока, пришедшего позже, — тоже выбраны.
      await scrollToIndex(500)
      await expect.poll(() => checked(checkbox(500))).toBe(true)

      // Снятый флажок — исключение; соседние остаются выбранными.
      await userEvent.click(checkbox(501)!)
      await expect
        .poll(() => changes.at(-1))
        .toEqual({ all: true, except: ['r501'] })
      expect(checked(checkbox(501))).toBe(false)
      expect(checked(checkbox(500))).toBe(true)
      expect(head().hasAttribute('data-indeterminate')).toBe(true)
      await expect.poll(count).toBe(tableLabels.selectedRows(999))

      // Флажок снова поставлен — исключения нет.
      await userEvent.click(checkbox(501)!)
      await expect.poll(() => changes.at(-1)).toEqual({ all: true, except: [] })
      expect(checked(checkbox(501))).toBe(true)
    } finally {
      await screen.unmount()
    }
  })
  describe('ленивые дети (этап 5)', () => {
    const CHILDREN = 5
    const hasChildren = (row: { depth: number }) => row.depth === 0
    /** Ответ «сервера» дерева: у корня — пять детей `<родитель>.<номер>`. */
    const treeAnswer = ({
      start,
      end,
      parentId,
    }: ServerRowsRequest): ServerRowsResponse<Item> =>
      parentId
        ? {
            rows: Array.from(
              { length: Math.max(0, Math.min(end, CHILDREN) - start) },
              (_, i) => ({
                id: `${parentId}.${start + i}`,
                name: `K${start + i}`,
                city: `C${(start + i) % 7}`,
              }),
            ),
            rowCount: CHILDREN,
          }
        : { rows: rowsOf(start, end) }
    const rowOf = (id: string) => q(`.data-grid__body-row[data-row-id="${id}"]`)
    const toggleOf = (id: string) =>
      rowOf(id)?.querySelector<HTMLElement>('.row-expand-button') ?? null
    /** Отступ содержимого первой пользовательской колонки строки. */
    const indentOf = (id: string) =>
      Number.parseFloat(
        getComputedStyle(
          rowOf(id)!.querySelector<HTMLElement>(
            '.data-grid__body-cell[data-column-id="name"]',
          )!,
        ).paddingLeft,
      )
    const bodyRows = (rows: number) =>
      expect
        .poll(() => body().getBoundingClientRect().height)
        .toBeCloseTo(rows * rowHeight(), -1)

    test('SD35: ленивые дети — у раскрытой строки своё хранилище блоков, getRows получает parentId и выборку, до ответа под строкой один блок скелетов; отказ и вытеснение блока детей — как у корней', async () => {
      let refuse = true
      // Первый запрос детей строки 1 ждёт ответа из теста.
      let hold = true
      const { calls, getRows } = server(request =>
        !request.parentId
          ? treeAnswer(request)
          : request.parentId === 'r3' && refuse
            ? new Error('down')
            : request.parentId === 'r1' && hold
              ? undefined
              : treeAnswer(request),
      )
      const sorting = [{ id: 'name', desc: false }]
      const branch = (id: string) =>
        calls.filter(call => call.request.parentId === id)
      const screen = await render(
        <Grid
          getRows={getRows}
          rowCount={1000}
          maxBlocks={3}
          plugins={[
            rowExpanding({ hasChildren }),
            columnSortingModel({ initialSorting: sorting } as never),
          ]}
        />,
      )
      try {
        await expect.poll(() => toggleOf('r1')).not.toBeNull()
        await humanClick(toggleOf('r1')!)
        await expect.poll(() => branch('r1').length).toBe(1)
        expect(branch('r1')[0]!.request).toMatchObject({
          start: 0,
          end: BLOCK,
          parentId: 'r1',
          sorting,
        })
        // До ответа — один блок скелетов под родителем, тело выросло на блок.
        await bodyRows(1000 + BLOCK)
        await expect.poll(() => pendingRow(2)).not.toBeNull()
        expect(rowAt(2)).toBeNull()

        // Ответ: пять детей за родителем, тело — на итог ветки.
        hold = false
        branch('r1')[0]!.settle(treeAnswer(branch('r1')[0]!.request))
        await expect.poll(() => rowAt(2)?.dataset.rowId).toBe('r1.0')
        expect(rowAt(2 + CHILDREN)?.dataset.rowId).toBe('r2')
        await bodyRows(1000 + CHILDREN)

        // Отказ блока детей — строка ошибки ветки, повтор перезапрашивает только её.
        await humanClick(toggleOf('r3')!)
        await expect.poll(errorRow).not.toBeNull()
        expect(errorRow()!.textContent).toContain('down')
        const first = 4 + CHILDREN
        expect(rowOf('r3.0')).toBeNull()
        refuse = false
        const before = calls.length
        await userEvent.click(errorRow()!.querySelector('button')!)
        await expect.poll(() => rowAt(first)?.dataset.rowId).toBe('r3.0')
        expect(calls.slice(before).map(call => call.request.parentId)).toEqual([
          'r3',
        ])
        expect(errorRow()).toBeNull()

        // Вытеснение: вдали три блока корней, блоки веток уходят; назад — запрос заново.
        await scrollToIndex(500)
        await expect.poll(() => rowAt(500)?.dataset.rowId).toBeDefined()
        await scrollToIndex(0)
        await expect.poll(() => branch('r1').length).toBe(2)
        await expect.poll(() => rowAt(2)?.dataset.rowId).toBe('r1.0')
      } finally {
        await screen.unmount()
      }
    })

    test('SD40: раскрытие в SSRM — кнопкой и клавишами, как в клиентском дереве; дети с отступом по уровню; expanded: true ветки не раскрывает, dev-warn', async () => {
      const { getRows } = server(treeAnswer)
      const screen = await render(
        <Grid
          getRows={getRows}
          rowCount={1000}
          plugins={[rowExpanding({ hasChildren }), keyboardNavigation()]}
        />,
      )
      try {
        // Кнопка колонки раскрытия.
        await expect.poll(() => toggleOf('r1')).not.toBeNull()
        await humanClick(toggleOf('r1')!)
        await expect.poll(() => rowOf('r1.0')).not.toBeNull()
        expect(rowOf('r1')!.getAttribute('aria-expanded')).toBe('true')
        // Отступ — шаг уровня, как у клиентского дерева (RE61).
        expect(indentOf('r1.0') - indentOf('r1')).toBe(16)

        // Клавиша: Enter на ячейке раскрытия сворачивает и раскрывает.
        await humanClick(
          rowOf('r1')!.querySelector<HTMLElement>('[data-column-id="name"]')!,
        )
        await press('{ArrowLeft}')
        await expect
          .poll(() => document.activeElement?.contains(toggleOf('r1')))
          .toBe(true)
        await press('{Enter}')
        await expect.poll(() => rowOf('r1.0')).toBeNull()
        await press('{Enter}')
        await expect.poll(() => rowOf('r1.0')).not.toBeNull()
      } finally {
        await screen.unmount()
      }

      // «Раскрыть всё» ветки не раскрывает и предупреждает.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const all = server(treeAnswer)
      const second = await render(
        <Grid
          getRows={all.getRows}
          rowCount={1000}
          plugins={[
            rowExpanding({ hasChildren, initialExpanded: true } as never),
          ]}
        />,
      )
      try {
        await expect.poll(() => toggleOf('r1')).not.toBeNull()
        await nextFrame()
        expect(all.calls.some(call => call.request.parentId)).toBe(false)
        expect(rowOf('r1')!.dataset.expanded).toBe('false')
        expect(
          warn.mock.calls.some(call =>
            call.some(
              part =>
                String(part).includes('expanded: true') &&
                String(part).includes('serverRowModel'),
            ),
          ),
        ).toBe(true)
      } finally {
        warn.mockRestore()
        await second.unmount()
      }
    })

    test('SD43: в роли treegrid aria-level, aria-posinset и aria-setsize строк и незагруженных строк ветки — из источника; axe в роли treegrid', async () => {
      // Дети ждут ответа из теста.
      const { calls, getRows } = server(request =>
        request.parentId ? undefined : treeAnswer(request),
      )
      const screen = await render(
        <Grid
          getRows={getRows}
          rowCount={1000}
          plugins={[rowExpanding({ hasChildren }), keyboardNavigation()]}
        />,
      )
      const aria = (row: Element | null) =>
        row && [
          row.getAttribute('aria-level'),
          row.getAttribute('aria-posinset'),
          row.getAttribute('aria-setsize'),
        ]
      try {
        await expect.poll(() => toggleOf('r1')).not.toBeNull()
        expect(q('[role="treegrid"]')).not.toBeNull()
        expect(aria(rowOf('r1'))).toEqual(['1', '2', '1000'])
        await humanClick(toggleOf('r1')!)
        // Незагруженная строка ветки: уровень и место из источника, до ответа — блок.
        await expect
          .poll(() => aria(pendingRow(3)))
          .toEqual(['2', '2', `${BLOCK}`])
        const children = calls.find(call => call.request.parentId === 'r1')!
        children.settle(treeAnswer(children.request))
        await expect
          .poll(() => aria(rowOf('r1.1')))
          .toEqual(['2', '2', `${CHILDREN}`])
        expect(aria(rowOf('r2'))).toEqual(['1', '3', '1000'])

        // axe — с незагруженной веткой в окне.
        await humanClick(toggleOf('r2')!)
        await expect.poll(() => pendingRow(4 + CHILDREN)).not.toBeNull()
        const { violations } = await axe.run(q('.data-grid-theme')!, {
          ...AXE_OPTIONS,
          rules: {
            ...AXE_OPTIONS.rules,
            'color-contrast': { enabled: true },
          },
        })
        expect(violations).toEqual([])
      } finally {
        await screen.unmount()
      }
    })

    test('SD45: выбор в дереве SSRM — флажки только у корней; «Выбрать всё» — итог корней', async () => {
      const { getRows } = server(treeAnswer)
      const changes: unknown[] = []
      const screen = await render(
        <Grid
          getRows={getRows}
          rowCount={1000}
          plugins={[
            rowExpanding({ hasChildren }),
            // Выбор вложенных включён — в SSRM их флажков всё равно нет.
            rowSelection({
              subRows: true,
              selectedCount: true,
              onRowSelectionChange: next => changes.push(next),
            }),
          ]}
        />,
      )
      const checkbox = (id: string) =>
        rowOf(id)?.querySelector<HTMLElement>('.row-select-checkbox') ?? null
      const count = () =>
        q('[data-testid="selected-rows-count"]')?.textContent?.trim() ?? ''
      try {
        await expect.poll(() => toggleOf('r1')).not.toBeNull()
        await humanClick(toggleOf('r1')!)
        await expect.poll(() => rowOf('r1.0')).not.toBeNull()
        expect(checkbox('r1')).not.toBeNull()
        expect(checkbox('r1.0')).toBeNull()

        await userEvent.click(q('.data-grid__head-cell .row-select-checkbox')!)
        await expect
          .poll(() => changes.at(-1))
          .toEqual({ all: true, except: [] })
        await expect.poll(count).toBe(tableLabels.selectedRows(1000))
        expect(rowOf('r1.0')!.getAttribute('data-selected')).toBe('false')
      } finally {
        await screen.unmount()
      }
    })
  })

  test('SD49: в SSRM пейджер, хвост скелет-строк ленты, ручки перетаскивания строк и кнопка группировки в шапке не показаны — и в конце списка', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getRows } = server(({ start, end }) => ({
      rows: rowsOf(start, end),
    }))
    /** Ничего от инертных плагинов на экране. */
    const expectNothing = () => {
      expect.soft(q('nav[data-testid="pagination"]'), 'пейджер').toBeNull()
      expect
        .soft(q('[data-testid="infinite-scroll-tail"]'), 'хвост ленты')
        .toBeNull()
      expect.soft(q('.drag__handler--column'), 'ручка строки').toBeNull()
      expect
        .soft(q('[data-row-draggable="true"]'), 'перетаскиваемая строка')
        .toBeNull()
      expect.soft(q('.column-group__button'), 'кнопка группировки').toBeNull()
    }
    // Пагинация — своим гридом: при ней лента инертна и без серверной модели.
    for (const plugins of [
      [
        columnSorting(),
        // Загрузка ленты не кончается: у живой ленты в конце стоял бы хвост скелетов.
        infiniteScroll({
          hasMore: true,
          onLoadMore: () => new Promise<void>(() => {}),
        }),
        rowDragging(),
        rowGrouping(),
      ],
      [columnSorting(), pagination()],
    ]) {
      const screen = await render(
        <Grid getRows={getRows} rowCount={1000} plugins={plugins} />,
      )
      try {
        await expect.poll(() => rowAt(0)?.dataset.rowId).toBe('r0')
        // Кнопки шапки — из ленивого модуля: пришла кнопка сортировки, пришла бы и группировки.
        await expect.poll(sortButton).not.toBeNull()
        expectNothing()
        // Конец списка: лента показала бы здесь хвост.
        await scrollToIndex(999)
        await expect.poll(() => rowAt(999)?.dataset.rowId).toBe('r999')
        expectNothing()
      } finally {
        await screen.unmount()
      }
    }
    warn.mockRestore()
  })
})
