import { useState } from 'react'

import type { SortingState } from '@tanstack/react-table'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { DataGrid } from '../../../grid/DataGrid'
import { useCreateTable } from '../../../core/useCreateTable'
import { columnFiltering } from '../../../plugins/columnFiltering'
import { columnSorting } from '../../../plugins/columnSorting'
import { headerActionMenu } from '../../../plugins/headerActionMenu'
import { keyboardNavigation } from '../../../plugins/keyboardNavigation'
import { pagination } from '../../../plugins/pagination'
import { quickSearch } from '../../../plugins/quickSearch'
import { humanClick, revealCellButtons } from '../helpers'

// Серверные действия (ADR 0116): ожидание у причины и свечение, отказ — откат, плашка с
// повтором и вспышка — настоящими событиями браузера. SA1–SA3, SA10 — модульные
// (`src/lib/__tests__/serverActions.dom.test.tsx`).

interface Deferred {
  promise: Promise<void>
  reject: (error: unknown) => void
  resolve: () => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

const BASE_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' },
  { id: 'value', accessorKey: 'value', header: 'Value' },
]
const wideColumns = (extra: number) => [
  ...BASE_COLUMNS,
  ...Array.from({ length: extra }, (_, index) => ({
    id: `c${index}`,
    accessorKey: 'value',
    header: `C${index}`,
    size: 160,
  })),
]
const DATA = Array.from({ length: 100 }, (_, index) => ({
  id: String(index),
  name: `Row ${index}`,
  value: index,
}))

interface Options {
  sortingServer?: boolean
  paginationServer?: boolean
  pageSize: number
  controlled?: boolean
  search?: boolean
  filter?: boolean
  menu?: boolean
  keyboard?: boolean
  extraColumns?: number
  loading?: 'refresh'
  loadError?: unknown
  onRetry?: () => void
  refreshOptions?: { delayMs?: number; minDurationMs?: number }
}

interface Call {
  kind: string
  args: unknown[]
  answer: Deferred
}

interface Harness {
  options: Options
  calls: Call[]
  onSortingChange: ReturnType<typeof vi.fn<(sorting: SortingState) => void>>
}

let harness: Harness

const answer =
  (kind: string) =>
  (...args: unknown[]) => {
    const call = { kind, args: args.slice(0, -1), answer: deferred() }
    harness.calls.push(call)
    return call.answer.promise
  }

const Grid = () => {
  const { options } = harness
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useCreateTable({
    columns: wideColumns(options.extraColumns ?? 0) as never,
    data: options.paginationServer ? DATA.slice(0, options.pageSize) : DATA,
    loading: options.loading ?? false,
    loadError: options.loadError,
    onRetry: options.onRetry,
    refreshOptions: options.refreshOptions ?? { delayMs: 0, minDurationMs: 0 },
    plugins: [
      columnSorting({
        server: options.sortingServer,
        multiSort: false,
        onToggleColumnSort: answer('sort'),
        ...(options.controlled
          ? {
              sorting,
              onSortingChange: (next: SortingState) => {
                harness.onSortingChange(next)
                setSorting(next)
              },
            }
          : {}),
      }),
      pagination({
        server: options.paginationServer,
        rowCount: options.paginationServer ? 1000 : undefined,
        initialPageSize: options.pageSize,
        onPageChange: answer('page'),
      }),
      ...(options.search
        ? [quickSearch({ server: true, onSearchChange: answer('search') })]
        : []),
      ...(options.filter
        ? [columnFiltering({ server: true, onFilterChange: answer('filter') })]
        : []),
      ...(options.menu ? [headerActionMenu({ mode: 'always' })] : []),
      ...(options.keyboard ? [keyboardNavigation()] : []),
    ],
  })
  return (
    <div style={{ height: 500, width: 700 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

const mount = async (options: Options) => {
  harness = { options, calls: [], onSortingChange: vi.fn() }
  const result = await render(<Grid />)
  await expect.poll(() => headCell('name')).not.toBeNull()
  return result
}

const lastCall = () => harness.calls.at(-1)!

const headCell = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"][aria-colindex]`,
  )
const ariaSort = () => headCell('name')!.getAttribute('aria-sort')
const sortButton = () =>
  headCell('name')?.querySelector<HTMLElement>('.column-sort__button') ?? null
const filterButton = () =>
  headCell('name')!.querySelector<HTMLElement>('.column-filter__button')!
const kebab = () =>
  headCell('name')!.querySelector<HTMLElement>(
    '[aria-label^="Column options"]',
  )!
const range = () =>
  document.querySelector<HTMLElement>('[data-testid="pagination-range"]')!
    .textContent
const pageButton = (action: 'next' | 'previous') =>
  document.querySelector<HTMLButtonElement>(`[data-page-action="${action}"]`)!
const sizeTrigger = () =>
  document.querySelector<HTMLElement>('[data-testid="page-size-select"]')
const searchInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')!
const scroller = () =>
  document.querySelector<HTMLElement>('.data-grid__container')!
const glowing = () => !!document.querySelector('[data-refreshing]')
const redLight = () =>
  document
    .querySelector('[class*="linear-progress"]')
    ?.getAttribute('data-error-flash')
const banner = () =>
  document.querySelector<HTMLElement>('[data-testid="load-error-banner"]')
const retryButton = () =>
  document.querySelector<HTMLElement>('[data-testid="load-error-retry"]')!
const liveText = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!
    .textContent
const busy = (element: Element | null) =>
  element?.getAttribute('aria-busy') === 'true'
const lit = (element: Element | null) =>
  busy(element) && !!element?.hasAttribute('data-pending')

const chooseSize = async (size: number) => {
  await expect.poll(sizeTrigger).not.toBeNull()
  await userEvent.click(sizeTrigger()!)
  const option = await vi.waitFor(() => {
    const item = [
      ...document.querySelectorAll<HTMLElement>('[role="option"]'),
    ].find(node => node.textContent?.trim() === String(size))
    if (!item) throw new Error(`option ${size} not rendered`)
    return item
  })
  await userEvent.click(option)
}

const SERVER_ERROR = new Error('Server error')

const errorDot = () =>
  filterButton().querySelector<HTMLElement>('[data-error-indicator]')!
const panelFailure = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-failure"]')
const filterReason = () => {
  const id = filterButton().getAttribute('aria-describedby')
  return id ? document.getElementById(id)?.textContent : undefined
}
const tooltipShows = (text: string) =>
  [...document.querySelectorAll('[data-side]')].some(
    element => element.textContent?.trim() === text,
  )

/** Открыть панель фильтра колонки name и ввести значение — уходит запрос. */
const filterBy = async (text: string) => {
  if (!document.querySelector('[data-testid="filter-value"]')) {
    await revealCellButtons(headCell('name')!)
    await humanClick(filterButton())
  }
  const value = await vi.waitFor(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="filter-value"]',
    )
    if (!input) throw new Error('filter panel not open')
    return input
  })
  await userEvent.type(value, text)
  await expect.poll(() => lastCall()?.kind).toBe('filter')
}

describe('серверные действия (ADR 0116)', () => {
  test('SA4: пока промис не выполнен, у причины свет ожидания и aria-busy — кнопка сортировки, кебаб, контрол пагинатора, кнопка фильтра', async () => {
    const view = await mount({
      sortingServer: true,
      paginationServer: true,
      pageSize: 25,
      filter: true,
    })
    await userEvent.click(sortButton()!)
    await expect.poll(() => lit(sortButton())).toBe(true)

    // Новое действие гасит свет прежней причины.
    await userEvent.click(pageButton('next'))
    await expect.poll(() => lit(pageButton('next'))).toBe(true)
    expect(busy(sortButton())).toBe(false)

    await chooseSize(50)
    await expect.poll(() => lit(sizeTrigger())).toBe(true)
    expect(busy(pageButton('next'))).toBe(false)

    await revealCellButtons(headCell('name')!)
    await humanClick(filterButton())
    const value = await vi.waitFor(() => {
      const input = document.querySelector<HTMLInputElement>(
        '[data-testid="filter-value"]',
      )
      if (!input) throw new Error('filter panel not open')
      return input
    })
    await userEvent.type(value, 'x')
    await expect.poll(() => lit(filterButton())).toBe(true)
    expect(busy(sizeTrigger())).toBe(false)
    await view.unmount()

    await mount({ sortingServer: true, pageSize: 25, menu: true })
    await userEvent.click(kebab())
    const item = await vi.waitFor(() => {
      const found = [
        ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ].find(node => node.textContent?.trim() === 'Sort descending')
      if (!found) throw new Error('menu not open')
      return found
    })
    await userEvent.click(item)
    await expect.poll(() => lit(kebab())).toBe(true)
  })

  test('SA19: поиск из поля — у поля нет света, вспышки и отметок; ожидание — свечение под шапкой, отказ — красный свет и плашка с причиной и «Повторить», который повторяет поиск', async () => {
    await mount({ paginationServer: true, pageSize: 25, search: true })
    const field = searchInput().parentElement!
    const fieldMarks = () =>
      [field, ...field.querySelectorAll('*')].filter(
        node =>
          node.hasAttribute('aria-busy') ||
          node.hasAttribute('aria-invalid') ||
          node.hasAttribute('data-pending') ||
          node.hasAttribute('data-error-flash'),
      ).length
    await userEvent.type(searchInput(), 'Row')
    await expect.poll(() => lastCall()?.kind).toBe('search')
    await expect.poll(glowing).toBe(true)
    expect(fieldMarks()).toBe(0)
    // Иконки поля с введённым текстом: поиск, «и», очистка — отказ своих не добавляет.
    const icons = field.querySelectorAll('svg').length

    lastCall().answer.reject(new Error('Search is unavailable'))
    await expect.poll(redLight).toBe('on')
    await expect.poll(banner).not.toBeNull()
    expect(banner()!.textContent).toContain('Search is unavailable')
    expect(fieldMarks()).toBe(0)
    expect(field.querySelectorAll('svg').length).toBe(icons)
    expect(searchInput().value).toBe('Row')

    const failed = lastCall()
    const sent = harness.calls.length
    await userEvent.click(retryButton())
    await expect.poll(() => harness.calls.length).toBe(sent + 1)
    expect(lastCall().kind).toBe('search')
    expect(lastCall().args).toEqual(failed.args)
    await expect.poll(glowing).toBe(true)
    expect(fieldMarks()).toBe(0)
  })

  test('SA9: отказ поиска или фильтра колонки оставляет текст и значения; следующая правка или повтор отправляют их снова', async () => {
    await mount({
      paginationServer: true,
      pageSize: 25,
      search: true,
      filter: true,
    })
    await userEvent.type(searchInput(), 'Row')
    await expect.poll(() => lastCall()?.kind).toBe('search')
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(banner).not.toBeNull()
    expect(searchInput().value).toBe('Row')
    await userEvent.type(searchInput(), ' 1')
    await expect.poll(() => lastCall().args[0]).toBe('Row 1')

    await filterBy('x')
    const value = () =>
      document.querySelector<HTMLInputElement>('[data-testid="filter-value"]')!
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(() => errorDot().getAttribute('data-shown')).toBe('true')
    expect(value().value).toBe('x')
    await userEvent.type(value(), 'y')
    await expect.poll(() => JSON.stringify(lastCall().args)).toContain('"xy"')
  })

  test('SA18: кнопка фильтра после отказа — красный свет, затем ErrorDot, причина — описание кнопки; в открытой панели у кнопки сброса — иконка ошибки с тултипом причины', async () => {
    await mount({ paginationServer: true, pageSize: 25, filter: true })
    await filterBy('x')
    lastCall().answer.reject(new Error('Filter is unavailable'))
    await expect
      .poll(() => filterButton().getAttribute('data-error-flash'))
      .toBe('on')
    // Отметка проявляется, когда погаснет красный свет.
    expect(errorDot().getAttribute('data-shown')).toBe('true')
    expect(
      parseFloat(getComputedStyle(errorDot()).transitionDelay),
    ).toBeGreaterThan(0)
    expect(filterReason()).toBe('Filter is unavailable')

    await expect.poll(panelFailure).not.toBeNull()
    expect(panelFailure()!.getAttribute('aria-label')).toBe(
      'Filter is unavailable',
    )
    const reset = document.querySelector('[data-testid="filter-reset"]')!
    expect(panelFailure()!.nextElementSibling).toBe(reset)
    await userEvent.hover(panelFailure()!)
    await expect
      .poll(() => tooltipShows('Filter is unavailable'), { timeout: 2000 })
      .toBe(true)
  })

  test('SA20: отметка отказа кнопки фильтра снимается успехом следующего действия или «Закрыть» плашки; в ожидании вместо неё — свет ожидания', async () => {
    await mount({ paginationServer: true, pageSize: 25, filter: true })
    await filterBy('x')
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(() => errorDot().getAttribute('data-shown')).toBe('true')
    await userEvent.keyboard('{Escape}')

    // Повтор ждёт — свет вместо отметки; отказ повтора возвращает отметку.
    await userEvent.click(retryButton())
    await expect.poll(() => lit(filterButton())).toBe(true)
    expect(errorDot().getAttribute('data-shown')).toBe('false')
    expect(filterButton().hasAttribute('aria-describedby')).toBe(false)
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(() => errorDot().getAttribute('data-shown')).toBe('true')

    // Успех следующего действия снимает отметку.
    await userEvent.click(pageButton('next'))
    lastCall().answer.resolve()
    await expect.poll(() => errorDot().getAttribute('data-shown')).toBe('false')
    expect(filterReason()).toBeUndefined()

    // «Закрыть» плашки — тоже.
    await filterBy('y')
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(() => errorDot().getAttribute('data-shown')).toBe('true')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(
      document.querySelector<HTMLElement>(
        '[data-testid="load-error-banner"] [data-alert-dismiss]',
      )!,
    )
    await expect.poll(() => errorDot().getAttribute('data-shown')).toBe('false')
  })

  test('SA5: пока промис не выполнен, грид сам показывает свечение обновления с задержкой и минимумом refreshOptions, без пропа loading; проп loading складывается с ним', async () => {
    const delayed = await mount({
      sortingServer: true,
      pageSize: 25,
      refreshOptions: { delayMs: 400, minDurationMs: 0 },
    })
    await userEvent.click(sortButton()!)
    expect(glowing()).toBe(false)
    await expect.poll(glowing).toBe(true)
    lastCall().answer.resolve()
    await expect.poll(glowing).toBe(false)
    await delayed.unmount()

    const lasting = await mount({
      sortingServer: true,
      pageSize: 25,
      refreshOptions: { delayMs: 0, minDurationMs: 800 },
    })
    await userEvent.click(sortButton()!)
    await expect.poll(glowing).toBe(true)
    lastCall().answer.resolve()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(glowing()).toBe(true)
    await expect.poll(glowing, { timeout: 3000 }).toBe(false)
    await lasting.unmount()

    await mount({ sortingServer: true, pageSize: 25, loading: 'refresh' })
    await expect.poll(glowing).toBe(true)
    await userEvent.click(sortButton()!)
    lastCall().answer.resolve()
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(glowing()).toBe(true)
  })

  test('SA6: ожидание переживает уход колонки и строк из окна виртуализации и возврат', async () => {
    await mount({ sortingServer: true, pageSize: 100, extraColumns: 30 })
    await userEvent.click(sortButton()!)
    await expect.poll(() => lit(sortButton())).toBe(true)

    scroller().scrollLeft = scroller().scrollWidth
    await expect.poll(() => headCell('name')).toBeNull()
    scroller().scrollTop = scroller().scrollHeight
    await new Promise(resolve => requestAnimationFrame(resolve))
    scroller().scrollLeft = 0
    scroller().scrollTop = 0
    await expect.poll(() => lit(sortButton())).toBe(true)
    expect(glowing()).toBe(true)
  })

  test('SA7: отказ сортировки возвращает её вместе со сбросом страницы, вызванным сортировкой; при контролируемом state.sorting откат приходит в onSortingChange', async () => {
    const own = await mount({ sortingServer: true, pageSize: 10 })
    await userEvent.click(pageButton('next'))
    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('21–30 of 100')

    await userEvent.click(sortButton()!)
    await expect.poll(ariaSort).toBe('descending')
    await expect.poll(range).toBe('1–10 of 100')

    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(ariaSort).toBe('none')
    await expect.poll(range).toBe('21–30 of 100')
    await own.unmount()

    await mount({ sortingServer: true, pageSize: 10, controlled: true })
    await userEvent.click(sortButton()!)
    await expect.poll(ariaSort).toBe('descending')
    expect(harness.onSortingChange).toHaveBeenLastCalledWith([
      { id: 'name', desc: true },
    ])

    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(ariaSort).toBe('none')
    expect(harness.onSortingChange).toHaveBeenLastCalledWith([])
  })

  test('SA8: отказ смены страницы или её размера возвращает pageIndex и pageSize', async () => {
    await mount({ paginationServer: true, pageSize: 25 })
    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('26–50 of 1000')
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(range).toBe('1–25 of 1000')

    await userEvent.click(pageButton('next'))
    lastCall().answer.resolve()
    await expect.poll(range).toBe('26–50 of 1000')

    await chooseSize(50)
    await expect.poll(range).toBe('1–50 of 1000')
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(range).toBe('26–50 of 1000')
  })

  test('SA11: отказ показывает красный свет и плашку с причиной; «Повторить» повторяет отказавшее действие; loadError приложения главнее; ошибку грида снимает успех следующего действия или «Закрыть»', async () => {
    const own = await mount({
      sortingServer: true,
      paginationServer: true,
      pageSize: 25,
    })
    await userEvent.click(sortButton()!)
    lastCall().answer.reject(new Error('Sorting is unavailable'))
    await expect.poll(banner).not.toBeNull()
    expect(banner()!.textContent).toContain('Sorting is unavailable')
    // Красный свет под шапкой — вспышка полосы загрузки (ADR 0096).
    await expect.poll(redLight).toBe('on')

    // Повтор — то же действие с теми же аргументами; плашка уходит на время ожидания.
    const failedArgs = lastCall().args
    await userEvent.click(retryButton())
    await expect.poll(() => harness.calls.length).toBe(2)
    expect(lastCall().kind).toBe('sort')
    expect(lastCall().args).toEqual(failedArgs)
    await expect.poll(ariaSort).toBe('descending')
    await expect.poll(banner).toBeNull()

    // Отказ без текста — подпись действия; успех следующего действия снимает ошибку.
    lastCall().answer.reject(undefined)
    await expect
      .poll(() => banner()?.textContent ?? '')
      .toContain("Sorting wasn't applied")
    await userEvent.click(pageButton('next'))
    lastCall().answer.resolve()
    await expect.poll(banner).toBeNull()

    // «Закрыть» снимает ошибку грида.
    await userEvent.click(sortButton()!)
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(banner).not.toBeNull()
    await userEvent.click(
      document.querySelector<HTMLElement>(
        '[data-testid="load-error-banner"] [data-alert-dismiss]',
      )!,
    )
    await expect.poll(banner).toBeNull()
    await own.unmount()

    // Ошибка приложения главнее: её причина и её повтор.
    const onRetry = vi.fn()
    await mount({
      sortingServer: true,
      pageSize: 25,
      loadError: new Error('App error'),
      onRetry,
    })
    await expect.poll(banner).not.toBeNull()
    await userEvent.click(sortButton()!)
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(ariaSort).toBe('none')
    expect(banner()!.textContent).toContain('App error')
    expect(banner()!.textContent).not.toContain('Server error')
    await userEvent.click(retryButton())
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(harness.calls).toHaveLength(1)
  })

  test('SA12: при отказе у причины вспышка errorFlash, отказ объявляется с причиной', async () => {
    await mount({ sortingServer: true, paginationServer: true, pageSize: 25 })
    await userEvent.click(sortButton()!)
    lastCall().answer.reject(new Error('Sorting is unavailable'))
    await expect
      .poll(() => sortButton()!.getAttribute('data-error-flash'))
      .toBe('on')
    await expect
      .poll(liveText)
      .toContain("Couldn't refresh the data: Sorting is unavailable")

    await userEvent.click(pageButton('next'))
    lastCall().answer.reject(SERVER_ERROR)
    await expect
      .poll(() => pageButton('next').getAttribute('data-error-flash'))
      .toBe('on')
  })

  test('SA13: с клавиатуры — Enter на заголовке и контролы пагинатора — то же ожидание и откат, фокус остаётся на причине; с keyboardNavigation и без', async () => {
    const withPlugin = await mount({
      sortingServer: true,
      paginationServer: true,
      pageSize: 25,
      keyboard: true,
    })
    headCell('name')!.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => lit(sortButton())).toBe(true)
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(ariaSort).toBe('none')
    expect(document.activeElement).toBe(headCell('name'))
    await withPlugin.unmount()

    await mount({ sortingServer: true, paginationServer: true, pageSize: 25 })
    await revealCellButtons(headCell('name')!)
    sortButton()!.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => lit(sortButton())).toBe(true)
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(ariaSort).toBe('none')
    expect(document.activeElement).toBe(sortButton())

    pageButton('next').focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => lit(pageButton('next'))).toBe(true)
    await expect.poll(range).toBe('26–50 of 1000')
    lastCall().answer.reject(SERVER_ERROR)
    await expect.poll(range).toBe('1–25 of 1000')
    expect(document.activeElement).toBe(pageButton('next'))
  })
})
