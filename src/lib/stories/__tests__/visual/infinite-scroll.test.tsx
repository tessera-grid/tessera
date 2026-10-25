import { useState } from 'react'
import axe from 'axe-core'
import { commands, page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  columnFiltering,
  columnPinning,
  columnSorting,
  dataExport,
  infiniteScroll,
  type InfiniteScrollLoadContext,
  keyboardNavigation,
  quickSearch,
  rowDragging,
  rowExpanding,
  rowSelection,
} from '../../../plugins'
import { getSkeletonBarWidth } from '../../../core/skeletonOptions'
import { humanClick } from '../helpers'
import {
  AXE_OPTIONS,
  backgroundOf,
  contrast,
  inBothThemes,
  toRgba,
} from './a11y-helpers'
import { tableLabels } from '../labels'

// Бесконечная прокрутка — лента (ADR 0081; IS1–IS4, IS7, IS9–IS15): ответы
// «сервера» держит тест — промис каждого вызова `onLoadMore` в очереди `calls`.
// Модульные IS5, IS6, IS8 — в `infiniteScroll`, перф IS16 — в `interaction`, IS17 —
// в `scroll`.

interface Point {
  x: number
  y: number
}

const pointer = commands as unknown as {
  realWheel: (
    at: Point,
    deltaY: number,
    ticks: number,
    intervalMs: number,
  ) => Promise<void>
}

interface Item {
  id: string
  a: string
  b: string
  c: string
  subRows?: Item[]
}

const item = (i: number): Item => ({
  id: `r${i}`,
  a: `A${i}`,
  b: `B${i}`,
  c: `C${i}`,
})
const itemsFrom = (from: number, count: number) =>
  Array.from({ length: count }, (_, k) => item(from + k))

const COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 160, filter: 'text' },
  { id: 'b', accessorKey: 'b', header: 'B', size: 160 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 160 },
]

interface Call {
  ctx: InfiniteScrollLoadContext
  resolve: () => void
  reject: (error: Error) => void
}

let calls: Call[] = []
let feed: { append: (count: number) => void }
let table: {
  setSorting: (value: unknown) => void
  setColumnFilters: (value: unknown) => void
  setGlobalFilter: (value: unknown) => void
  store: { get: () => Record<string, unknown> }
}

interface FeedProps {
  initial?: number
  total?: number
  knownTotal?: boolean
  loadedCount?: boolean
  threshold?: number
  plugins?: unknown[]
  state?: Record<string, unknown>
  /** Колонки шире грида — есть горизонтальная прокрутка. */
  wide?: boolean
  columns?: unknown[]
  loading?: 'initial' | false
}

const WIDE_COLUMNS = [
  ...COLUMNS,
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `w${i}`,
    accessorFn: () => i,
    header: `W${i}`,
    size: 160,
  })),
]

const Feed = ({
  initial = 30,
  total = 100,
  knownTotal = true,
  loadedCount = false,
  threshold,
  plugins = [],
  state,
  wide = false,
  columns,
  loading,
}: FeedProps) => {
  const [rows, setRows] = useState(() => itemsFrom(0, initial))
  feed = {
    append: count =>
      setRows(prev => [...prev, ...itemsFrom(prev.length, count)]),
  }
  table = useCreateTable({
    columns: (columns ?? (wide ? WIDE_COLUMNS : COLUMNS)) as never,
    loading,
    data: rows,
    getRowId: (row: Item) => row.id,
    state: state as never,
    plugins: [
      infiniteScroll({
        onLoadMore: ctx =>
          new Promise<void>((resolve, reject) =>
            calls.push({ ctx, resolve, reject }),
          ),
        hasMore: rows.length < total,
        rowCount: knownTotal ? total : undefined,
        loadedCount,
        threshold,
      }),
      ...plugins,
    ] as never,
  }) as never
  return (
    <div style={{ width: 640, height: 400, background: 'var(--card)' }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const frame = () => new Promise(requestAnimationFrame)
const frames = async (count = 3) => {
  for (let i = 0; i < count; i++) await frame()
}

const mount = async (props: FeedProps = {}) => {
  const screen = await render(<Feed {...props} />)
  await expect
    .poll(() => document.querySelectorAll('.data-grid__body-row').length)
    .toBeGreaterThan(0)
  await frames()
  return screen
}

const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const gridRoot = () => document.querySelector<HTMLElement>('.data-grid__table')!
const tailRows = () =>
  document.querySelectorAll<HTMLElement>(
    '.data-grid__body--infinite-tail .data-grid__body-row--skeleton',
  )
const errorRow = () =>
  document.querySelector<HTMLElement>('[data-testid="infinite-scroll-error"]')
const retryButton = () =>
  errorRow()?.querySelector<HTMLButtonElement>('button') ?? null
const rowEl = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id="${id}"]`,
  )
const cellEl = (rowId: string, columnId: string) =>
  rowEl(rowId)?.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`) ??
  null
const liveText = () =>
  [...document.querySelectorAll('[aria-live]')]
    .map(node => node.textContent)
    .join('|')

/** Прокрутить тело к концу загруженных строк и дождаться вызова. */
const scrollToEnd = async () => {
  const el = scroller()
  el.scrollTop = el.scrollHeight
  await frames()
}

const pendingCall = async (count = 1) => {
  await expect.poll(() => calls.length).toBe(count)
  return calls[count - 1]!
}

/** Ответ «сервера»: блок в конец `data`, затем промис выполнен. */
const respond = async (count: number) => {
  const call = calls.shift()!
  feed.append(count)
  call.resolve()
  await frames(4)
}

const fail = async (reason: unknown = new Error('Server error')) => {
  calls.shift()!.reject(reason as Error)
  await frames(3)
}

beforeAll(async () => {
  await page.viewport(1000, 800)
})

beforeEach(() => {
  calls = []
})

describe('Лента: когда грид просит блок', () => {
  test('IS1: прокрутка на threshold строк до края вызывает onLoadMore один раз с loaded и signal; по умолчанию порог — строк в окне', async () => {
    await mount()
    let el = scroller()
    const box = el.getBoundingClientRect()
    const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    const edge = () =>
      el.scrollHeight - el.scrollTop - el.clientHeight - el.clientHeight

    // Колесом — пока до края больше окна, блок не просим.
    while (edge() > 150) {
      await pointer.realWheel(at, 100, 1, 30)
      await frames(2)
    }
    expect(calls).toHaveLength(0)
    await pointer.realWheel(at, 100, 3, 30)
    const call = await pendingCall()
    expect(call.ctx.loaded).toBe(30)
    expect(call.ctx.signal).toBeInstanceOf(AbortSignal)
    expect(call.ctx.signal.aborted).toBe(false)
    await frames(4)
    expect(calls).toHaveLength(1)

    // Явный threshold — блок только за threshold строк до края
    await cleanup()
    calls = []
    await mount({ threshold: 2 })
    el = scroller()
    // До края — три строки: больше порога в две.
    el.scrollTop = el.scrollHeight - el.clientHeight - 150
    await frames(4)
    expect(calls).toHaveLength(0)
    el.scrollTop = el.scrollHeight - el.clientHeight - 80
    await pendingCall()
  })
})

describe('Лента: хвост ожидания и ответ', () => {
  test('IS2: пока промис ожидает, после последней строки — скелет-строки на высоту окна (не больше rowCount − loaded), с закреплёнными и служебными колонками; повторных вызовов нет, грид aria-busy', async () => {
    await mount({
      plugins: [rowSelection(), columnPinning()],
      state: { columnPinning: { start: ['a'], end: [] } },
    })
    await scrollToEnd()
    await pendingCall()
    await frames()
    const viewportRows = Math.ceil(
      scroller().clientHeight /
        Number.parseFloat(
          getComputedStyle(scroller()).getPropertyValue(
            '--tsr-comp-row-height',
          ),
        ),
    )
    expect(tailRows()).toHaveLength(viewportRows)
    expect(gridRoot().getAttribute('aria-busy')).toBe('true')

    const bodyColumns = [
      ...rowEl('r29')!.querySelectorAll<HTMLElement>('[data-column-id]'),
    ].map(cell => cell.dataset.columnId)
    const tailColumns = [
      ...tailRows()[0]!.querySelectorAll<HTMLElement>('[data-column-id]'),
    ].map(cell => cell.dataset.columnId)
    expect(tailColumns).toEqual(bodyColumns)
    expect(bodyColumns.length).toBeGreaterThan(3)
    const pinned = tailRows()[0]!.querySelector<HTMLElement>(
      '[data-column-id="a"]',
    )!
    expect(pinned.dataset.cellPinned).toBeTruthy()
    expect(
      pinned.getBoundingClientRect().left -
        scroller().getBoundingClientRect().left,
    ).toBeCloseTo(
      cellEl('r29', 'a')!.getBoundingClientRect().left -
        scroller().getBoundingClientRect().left,
      0,
    )

    // Дальнейшие события прокрутки нового вызова не дают.
    scroller().scrollTop = scroller().scrollHeight
    await frames(4)
    scroller().dispatchEvent(new Event('scroll'))
    await frames(4)
    expect(calls).toHaveLength(1)

    // Вне области прокрутки хвост держит только высоту, без ячеек; в окне — снова строки
    await cleanup()
    calls = []
    await mount()
    await scrollToEnd()
    await pendingCall()
    await frames()
    const block = () =>
      document.querySelector<HTMLElement>('.data-grid__body--infinite-tail')!
    const height = block().getBoundingClientRect().height
    expect(tailRows().length).toBeGreaterThan(0)
    scroller().scrollTop = 0
    await expect.poll(() => tailRows().length).toBe(0)
    expect(block().getBoundingClientRect().height).toBe(height)
    scroller().scrollTop = scroller().scrollHeight
    await expect.poll(() => tailRows().length).toBeGreaterThan(0)

    // Известный итог ограничивает хвост оставшимися строками
    await cleanup()
    calls = []
    await mount({ total: 33 })
    await scrollToEnd()
    await pendingCall()
    await frames()
    expect(tailRows()).toHaveLength(3)
  })

  test('IS3: ответ дописывает строки на место хвоста — позиция прокрутки и фокус не сдвигаются', async () => {
    await mount({ plugins: [keyboardNavigation()] })
    await scrollToEnd()
    await pendingCall()
    await humanClick(cellEl('r27', 'b')!)
    await expect
      .poll(() => document.activeElement === cellEl('r27', 'b'))
      .toBe(true)
    const top = scroller().scrollTop
    const before = cellEl('r27', 'b')!.getBoundingClientRect().top
    await respond(20)
    expect(tailRows()).toHaveLength(0)
    expect(rowEl('r30')).not.toBeNull()
    expect(scroller().scrollTop).toBe(top)
    expect(cellEl('r27', 'b')!.getBoundingClientRect().top).toBe(before)
    expect(document.activeElement).toBe(cellEl('r27', 'b'))
    expect(gridRoot().getAttribute('aria-busy')).toBeNull()
  })

  test('IS4: отказ — в конце списка блок ошибки: строка на всю ширину, содержимое по центру видимой ширины и при горизонтальной прокрутке, иконка, заголовок и причина из ошибки (без неё — только заголовок); «Retry» снова вызывает onLoadMore; пока блок на месте, край блок не просит', async () => {
    await mount({ wide: true })
    await scrollToEnd()
    await pendingCall()
    await fail()
    await expect.poll(errorRow).not.toBeNull()
    expect(tailRows()).toHaveLength(0)
    expect(errorRow()!.getAttribute('role')).toBe('row')
    expect(errorRow()!.getBoundingClientRect().width).toBeCloseTo(
      rowEl('r29')!.getBoundingClientRect().width,
      0,
    )
    expect(errorRow()!.textContent).toContain(tableLabels.loadMoreFailed)
    expect(errorRow()!.textContent).toContain('Server error')
    const icon = errorRow()!.querySelector<SVGElement>('svg')!
    expect(icon.getBoundingClientRect().width).toBeGreaterThan(0)
    expect(toRgba(getComputedStyle(icon).color)).toEqual(
      toRgba(getComputedStyle(scroller()).getPropertyValue('--tsr-sys-danger')),
    )
    // Блок в потоке, сразу за последней строкой, — не поверх таблицы.
    expect(errorRow()!.getBoundingClientRect().top).toBeCloseTo(
      rowEl('r29')!.getBoundingClientRect().bottom,
      0,
    )
    const centered = async () => {
      await frames(3)
      const view = scroller().getBoundingClientRect()
      const visibleCenter =
        view.left + (scroller().clientWidth || view.width) / 2
      const button = retryButton()!.getBoundingClientRect()
      expect(
        Math.abs(button.left + button.width / 2 - visibleCenter),
      ).toBeLessThan(4)
    }
    await centered()
    scroller().scrollLeft = 700
    await centered()

    scroller().scrollTop = scroller().scrollHeight
    await frames(4)
    scroller().dispatchEvent(new Event('scroll'))
    await frames(4)
    expect(calls).toHaveLength(0)

    await humanClick(retryButton()!)
    const retry = await pendingCall()
    expect(retry.ctx.loaded).toBe(30)
    await expect.poll(errorRow).toBeNull()
    expect(tailRows().length).toBeGreaterThan(0)

    // Отказ без текста — только заголовок, без пустой причины.
    await fail(null)
    await expect.poll(errorRow).not.toBeNull()
    expect(errorRow()!.textContent).not.toContain('Server error')
    expect(errorRow()!.querySelector('[class*="error-reason"]')).toBeNull()
  })
})

describe('Лента: смена условия выборки', () => {
  const plugins = () => [
    columnSorting({ server: true }),
    columnFiltering({ server: true }),
    quickSearch({ server: true }),
  ]
  const changes: [string, () => void][] = [
    ['сортировка', () => table.setSorting([{ id: 'a', desc: true }])],
    [
      'фильтр колонки',
      () =>
        table.setColumnFilters([
          { id: 'a', value: { op: 'contains', value: 'A' } },
        ]),
    ],
    ['поиск', () => table.setGlobalFilter('A1')],
  ]

  test('IS7: смена сортировки, фильтра колонки или поиска — тело в начале, signal отменён, хвост и строка ошибки сняты, отменённая загрузка не показывает ожидания и ошибки', async () => {
    for (const [name, change] of changes) {
      await mount({ plugins: plugins() })
      await scrollToEnd()
      const call = await pendingCall()
      await frames()
      expect(tailRows().length, name).toBeGreaterThan(0)

      change()
      await frames(4)
      expect(call.ctx.signal.aborted, name).toBe(true)
      expect(scroller().scrollTop, name).toBe(0)
      expect(tailRows(), name).toHaveLength(0)
      expect(gridRoot().getAttribute('aria-busy'), name).toBeNull()

      // Поздний отказ устаревшей загрузки — ни ошибки, ни объявления.
      call.reject(new Error('late'))
      await frames(4)
      expect(errorRow(), name).toBeNull()
      expect(liveText(), name).not.toContain(tableLabels.loadMoreFailed)
      await cleanup()
      calls = []
    }

    // Смена условия снимает строку ошибки.
    await mount({ plugins: plugins() })
    await scrollToEnd()
    await pendingCall()
    await fail()
    await expect.poll(errorRow).not.toBeNull()
    table.setSorting([{ id: 'b', desc: false }])
    await frames(4)
    expect(errorRow()).toBeNull()
    expect(scroller().scrollTop).toBe(0)
  })
})

describe('Лента: итог и доступность', () => {
  const counter = () =>
    document.querySelector('[data-testid="loaded-rows-count"]')

  test('IS9: loadedCount — «Loaded N of M» при известном итоге, «Loaded N» без него; без опции панели нет', async () => {
    const known = await mount({ loadedCount: true })
    expect(counter()?.textContent).toBe(tableLabels.loadedRowsOf(30, 100))
    await scrollToEnd()
    await pendingCall()
    await respond(20)
    expect(counter()?.textContent).toBe(tableLabels.loadedRowsOf(50, 100))
    await known.unmount()

    const unknown = await mount({ loadedCount: true, knownTotal: false })
    expect(counter()?.textContent).toBe(tableLabels.loadedRows(30))
    await unknown.unmount()

    await mount()
    expect(counter()).toBeNull()
    expect(
      document.querySelector('[data-testid="data-grid-status-bar"]'),
    ).toBeNull()
  })

  test('IS10: aria-rowcount — итог с учётом шапки или −1; aria-rowindex сквозной; приход блока и отказ объявлены', async () => {
    const known = await mount()
    expect(gridRoot().getAttribute('aria-rowcount')).toBe('101')
    await known.unmount()

    const done = await mount({ total: 30, knownTotal: false })
    expect(gridRoot().getAttribute('aria-rowcount')).toBe('31')
    await done.unmount()

    await mount({ knownTotal: false })
    expect(gridRoot().getAttribute('aria-rowcount')).toBe('-1')
    await scrollToEnd()
    await pendingCall()
    await respond(20)
    await expect.poll(liveText).toContain(tableLabels.announceMoreLoaded(20))
    scroller().scrollTop = scroller().scrollHeight
    await frames(4)
    expect(rowEl('r49')!.getAttribute('aria-rowindex')).toBe('51')
    await pendingCall()
    await fail()
    await expect.poll(liveText).toContain(tableLabels.loadMoreFailed)
    expect(errorRow()!.getAttribute('aria-rowindex')).toBe('52')
  })

  test('IS11: PageDown у края запускает загрузку', async () => {
    await mount({ plugins: [keyboardNavigation()] })
    await humanClick(cellEl('r0', 'a')!)
    for (let i = 0; i < 12 && calls.length === 0; i++) {
      await userEvent.keyboard('{PageDown}')
      await frames(2)
    }
    await pendingCall()

    // Ctrl+End у края запускает загрузку, фокус переживает приход блока; ↓ с последней строки — в строку ошибки, Enter — «Retry», ↑ — назад
    await cleanup()
    calls = []
    await mount({ plugins: [keyboardNavigation()] })
    await humanClick(cellEl('r0', 'a')!)
    await userEvent.keyboard('{Control>}{End}{/Control}')
    await pendingCall()
    await expect
      .poll(() =>
        (document.activeElement as HTMLElement | null)
          ?.closest('.data-grid__body-row')
          ?.getAttribute('data-row-id'),
      )
      .toBe('r29')
    const focused = document.activeElement
    await respond(20)
    expect(document.activeElement).toBe(focused)

    await userEvent.keyboard('{Control>}{End}{/Control}')
    await pendingCall()
    await fail()
    await expect.poll(errorRow).not.toBeNull()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(retryButton())
    await userEvent.keyboard('{Enter}')
    await pendingCall()
    expect(calls[0]!.ctx.loaded).toBe(50)
    // Строка ошибки ушла — фокус на последней строке, а не на body.
    expect(
      (document.activeElement as HTMLElement)
        .closest('.data-grid__body-row')
        ?.getAttribute('data-row-id'),
    ).toBe('r49')
    await fail()
    await expect.poll(errorRow).not.toBeNull()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(retryButton())
    await userEvent.keyboard('{ArrowUp}')
    expect(
      (document.activeElement as HTMLElement)
        .closest('.data-grid__body-row')
        ?.getAttribute('data-row-id'),
    ).toBe('r49')
  })

  test('IS12: скелет-строки не фокусируются, не выбираются, без действий, меню и перетаскивания, скрыты от вспомогательных технологий', async () => {
    await mount({ plugins: [rowSelection(), keyboardNavigation()] })
    await scrollToEnd()
    await pendingCall()
    await frames()
    const tail = document.querySelector<HTMLElement>(
      '.data-grid__body--infinite-tail',
    )!
    const hidden = tail.closest('[aria-hidden="true"]')!
    expect(hidden).not.toBeNull()
    expect(hidden.hasAttribute('inert')).toBe(true)
    expect(tail.querySelector('[role]')).toBeNull()
    expect(tail.querySelector('[data-row-id]')).toBeNull()
    expect(tail.querySelector('input, button, [tabindex]')).toBeNull()

    const selected = () =>
      Object.keys(
        (table.store.get().rowSelection as Record<string, boolean>) ?? {},
      ).length
    const before = document.activeElement
    await userEvent.click(tailRows()[0]!, { force: true })
    await frames()
    expect(selected()).toBe(0)
    expect(tail.contains(document.activeElement)).toBe(false)
    expect(document.activeElement).toBe(before)
  })

  test('IS13: «выбрать всё» — с isAllRowsSelected серверный контракт, без него только загруженные строки', async () => {
    let pageSelected: boolean | undefined
    const own = await mount({
      plugins: [
        rowSelection({
          onSelectAllRowsOnPage: value => {
            pageSelected = value
          },
        }),
      ],
    })
    const head = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__head [role="checkbox"], .data-grid__head input[type="checkbox"]',
      )!
    await humanClick(head())
    await frames()
    const selection = table.store.get().rowSelection as Record<string, boolean>
    expect(Object.keys(selection)).toHaveLength(30)
    expect(Object.keys(selection).sort(), JSON.stringify(selection)).toEqual(
      itemsFrom(0, 30)
        .map(row => row.id)
        .sort(),
    )
    expect(pageSelected).toBeDefined()
    await own.unmount()

    await mount({ plugins: [rowSelection({ isAllRowsSelected: true })] })
    expect(
      head().getAttribute('aria-disabled') === 'true' ||
        head().hasAttribute('disabled') ||
        head().hasAttribute('data-disabled'),
    ).toBe(true)
  })

  test('IS14: выгрузка — с dataExport({ server: true }) серверная, без него вариант all подписан «Loaded rows (N)»', async () => {
    const rowsLabel = async () => {
      await userEvent.click(
        document.querySelector<HTMLElement>('[data-testid="export-button"]')!,
      )
      await expect
        .poll(() => document.querySelector('[data-testid="export-panel"]'))
        .not.toBeNull()
      return document.querySelector<HTMLElement>(
        '[data-testid="export-axis-rows"] [role="radio"][data-value="all"]',
      )!.textContent
    }

    const client = await mount({ plugins: [dataExport()] })
    expect(await rowsLabel()).toContain(tableLabels.exportLoaded(30))
    await userEvent.keyboard('{Escape}')
    await client.unmount()

    await mount({
      plugins: [dataExport({ server: true, onExport: async () => {} })],
    })
    const label = await rowsLabel()
    expect(label).toContain(tableLabels.exportAll)
    expect(label).not.toContain('Loaded')
  })

  const roles: [string, () => unknown[]][] = [
    ['table', () => []],
    ['grid', () => [keyboardNavigation()]],
    ['treegrid', () => [keyboardNavigation(), rowExpanding()]],
  ]
  for (const [role, plugins] of roles) {
    test(`IS15: axe и color-contrast хвоста и строки ошибки в обеих темах, роль ${role}`, async () => {
      await mount({ plugins: plugins() })
      expect(gridRoot().getAttribute('role')).toBe(role)
      await scrollToEnd()
      await pendingCall()
      await frames()
      const run = async (state: string) =>
        inBothThemes(async () => {
          const { violations } = await axe.run(gridRoot(), {
            ...AXE_OPTIONS,
            rules: {
              ...AXE_OPTIONS.rules,
              'color-contrast': { enabled: true },
            },
          })
          expect(
            violations.map(v => `${v.id}: ${v.nodes[0]?.html}`),
            state,
          ).toEqual([])
        })
      await run('pending')
      await fail()
      await expect.poll(errorRow).not.toBeNull()
      await run('error')
      await inBothThemes(async () => {
        for (const text of errorRow()!.querySelectorAll<HTMLElement>(
          '[class*="error-title"], [class*="error-reason"]',
        )) {
          expect(
            contrast(toRgba(getComputedStyle(text).color), backgroundOf(text)),
            text.className,
          ).toBeGreaterThanOrEqual(4.5)
        }
        expect(
          contrast(
            toRgba(getComputedStyle(retryButton()!).color),
            backgroundOf(retryButton()),
          ),
        ).toBeGreaterThanOrEqual(4.5)
      })
    })
  }
})

describe('Лента: хвост скелетов', () => {
  test('IS19: хвост — строки скелета по раскладке колонок: вид ячейки по skeletonCell, длина полоски по колонке, высота строки грида, без волны', async () => {
    await mount({
      columns: [
        ...COLUMNS,
        {
          id: 'photo',
          accessorKey: 'a',
          header: 'Photo',
          skeletonCell: 'none',
        },
      ],
      plugins: [rowSelection(), rowDragging()],
    })
    await scrollToEnd()
    await pendingCall()
    await frames()
    const row = tailRows()[0]!
    const rowHeight = Number.parseFloat(
      getComputedStyle(scroller()).getPropertyValue('--tsr-comp-row-height'),
    )
    expect(Math.round(row.getBoundingClientRect().height)).toBe(rowHeight)
    const control = Number.parseFloat(
      getComputedStyle(scroller()).getPropertyValue(
        '--tsr-comp-skeleton-control-size',
      ),
    )
    const shapeIn = (id: string) =>
      [...row.querySelectorAll<HTMLElement>('[data-column-id]')]
        .find(cell =>
          ['a', 'b', 'c', 'photo'].includes(id)
            ? cell.dataset.columnId === id
            : cell.dataset.columnId!.includes(id),
        )!
        .querySelector<HTMLElement>('[class*="skeleton"]')
    for (const id of ['a', 'b', 'c']) {
      const cell = row.querySelector<HTMLElement>(`[data-column-id="${id}"]`)!
      const wrapper = cell.firstElementChild as HTMLElement
      const style = getComputedStyle(wrapper)
      const content =
        wrapper.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight)
      const ratio = Math.round(
        (shapeIn(id)!.getBoundingClientRect().width / content) * 100,
      )
      expect(Math.abs(ratio - getSkeletonBarWidth(id)), id).toBeLessThanOrEqual(
        1,
      )
    }
    expect(shapeIn('photo')).toBeNull()
    expect(shapeIn('rowDragging')).toBeNull()
    const square = shapeIn('rowSelection')!.getBoundingClientRect()
    expect([Math.round(square.width), Math.round(square.height)]).toEqual([
      control,
      control,
    ])
    for (const shape of row.querySelectorAll<HTMLElement>(
      '[class*="skeleton"]',
    )) {
      expect(getComputedStyle(shape, '::after').animationName).toBe('none')
    }
  })

  test("IS20: первая загрузка ленты (loading 'initial') — скелет грида без хвоста; счётчик «Loaded N» — скелетом", async () => {
    await render(<Feed loading="initial" loadedCount />)
    await expect
      .poll(
        () =>
          document.querySelectorAll(
            '.data-grid__body--skeleton .data-grid__body-row--skeleton',
          ).length,
      )
      .toBeGreaterThan(0)
    await frames()
    expect(document.querySelector('.data-grid__body--infinite-tail')).toBeNull()
    expect(tailRows()).toHaveLength(0)
    const counter = document.querySelector('[data-testid="loaded-rows-count"]')!
    expect(counter.textContent).toBe('')
    expect(counter.querySelector('[class*="skeleton"]')).not.toBeNull()
  })
})
