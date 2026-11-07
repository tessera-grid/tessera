import type { ReactElement } from 'react'

import axe from 'axe-core'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { DataGrid } from '../../../grid/DataGrid'
import { useCreateTable } from '../../../core/useCreateTable'
import { pagination } from '../../../plugins/pagination'
import { Stories, bodyRows, getScroller } from '../helpers'
import { AXE_OPTIONS } from './a11y-helpers'
import { tableLabels } from '../labels'
import { paginationLabels } from '../../../plugins/pagination/labels'

// Пагинация в нижней панели (ADR 0038, PG2–PG4, PG6, PG11–PG18). Каждый тест —
// одно требование, назван по его ID. Состояние читается из DOM-контракта (role,
// aria-*, data-*), а не из хешированных классов CSS-модулей. PG1, PG5, PG8–PG10 —
// модульные (`src/lib/__tests__/pagination.test.ts`), PG7 —
// `src/lib/__tests__/pagination.dom.test.tsx`.

const GRID = {
  containerHeight: 600,
  height: 500,
  columnCount: 6,
  dataCount: 1000,
  // Четыре кнопки ADR 0038; номера страниц — `page-numbers` (ADR 0192).
  paginationPageNumbers: false as const,
}

const nav = () =>
  document.querySelector<HTMLElement>('nav[data-testid="pagination"]')
const range = () =>
  document.querySelector<HTMLElement>('[data-testid="pagination-range"]')!
    .textContent
const pageButton = (action: 'first' | 'previous' | 'next' | 'last') =>
  document.querySelector<HTMLButtonElement>(`[data-page-action="${action}"]`)!
const disabledActions = () =>
  (['first', 'previous', 'next', 'last'] as const).filter(
    action => pageButton(action).getAttribute('aria-disabled') === 'true',
  )
const firstRowId = () =>
  bodyRows().sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  )[0]?.dataset.rowId
const live = () =>
  document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!
    .textContent
const gridRoot = () => document.querySelector<HTMLElement>('[aria-rowcount]')!
const firstRow = () =>
  bodyRows().sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  )[0]
const sizeTrigger = () =>
  document.querySelector<HTMLElement>('[data-testid="page-size-select"]')

const mount = async (node: ReactElement) => {
  const result = await render(node)
  await expect.poll(() => nav()).not.toBeNull()
  return result
}

const renderPagination = (extra: object = {}) =>
  mount(<Stories.PaginationPlayground {...GRID} {...extra} />)

// Сторис не пробрасывают localization/icons — PG16 рендерит грид напрямую.
const LOCALIZED_COLUMNS = [{ id: 'a', accessorKey: 'a', header: 'A' }]
const LOCALIZED_DATA = Array.from({ length: 60 }, (_, index) => ({
  id: String(index),
  a: `row ${index}`,
}))
const LOCALIZED_PLUGINS = [pagination()] as const
const CustomNextIcon = () => <svg data-testid="custom-next-icon" />

const LocalizedGrid = () => {
  const table = useCreateTable({
    columns: LOCALIZED_COLUMNS,
    data: LOCALIZED_DATA,
    plugins: LOCALIZED_PLUGINS,
  })
  return (
    <div style={{ height: 400 }}>
      <DataGrid
        table={table as never}
        localization={{
          'pagination.pagination': 'Страницы',
          'pagination.rowsPerPage': 'Строк на странице',
          'pagination.nextPage': 'Следующая',
          'pagination.pageRange': (from, to, total) =>
            `${from}–${to} из ${total}`,
        }}
        icons={{ nextPage: CustomNextIcon }}
      />
    </div>
  )
}

describe('Pagination', () => {
  test('PG2: first/previous/next/last switch the page; the edge buttons are disabled', async () => {
    await renderPagination()
    expect(firstRowId()).toBe('item-id-0')
    expect(disabledActions()).toEqual(['first', 'previous'])

    await userEvent.click(pageButton('next'))
    await expect.poll(firstRowId).toBe('item-id-25')
    expect(disabledActions()).toEqual([])

    await userEvent.click(pageButton('last'))
    await expect.poll(firstRowId).toBe('item-id-975')
    expect(disabledActions()).toEqual(['next', 'last'])

    await userEvent.click(pageButton('previous'))
    await expect.poll(firstRowId).toBe('item-id-950')

    await userEvent.click(pageButton('first'))
    await expect.poll(firstRowId).toBe('item-id-0')
  })

  test('PG3: the range shows "from–to of total"; an empty set shows "0–0 of 0" with all buttons disabled', async () => {
    const full = await renderPagination()
    expect(range()).toBe('1–25 of 1,000')
    await userEvent.click(pageButton('last'))
    await expect.poll(range).toBe('976–1,000 of 1,000')
    await full.unmount()

    await renderPagination({ dataCount: 0 })
    expect(range()).toBe('0–0 of 0')
    expect(disabledActions()).toEqual(['first', 'previous', 'next', 'last'])
  })

  test('PG4: choosing a page size changes pageSize and returns to the first page; pageSizes:false hides the choice', async () => {
    await renderPagination()
    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('26–50 of 1,000')

    await expect.poll(sizeTrigger).not.toBeNull()
    await userEvent.click(sizeTrigger()!)
    const option = await vi.waitFor(() => {
      const item = [
        ...document.querySelectorAll<HTMLElement>('[role="option"]'),
      ].find(node => node.textContent?.trim() === '100')
      if (!item) {
        throw new Error('option 100 not rendered')
      }
      return item
    })
    await userEvent.click(option)
    await expect.poll(range).toBe('1–100 of 1,000')
    expect(firstRowId()).toBe('item-id-0')
  })

  test('PG19: the page-size list is positioned like the other popovers — beside the trigger with a 4px gap, not over it', async () => {
    await renderPagination()
    await expect.poll(sizeTrigger).not.toBeNull()
    await userEvent.click(sizeTrigger()!)
    const positioner = await vi.waitFor(() => {
      const found = document
        .querySelector('[role="listbox"]')
        ?.closest<HTMLElement>('[data-side]')
      if (!found) {
        throw new Error('list not rendered')
      }
      return found
    })

    const trigger = sizeTrigger()!.getBoundingClientRect()
    const list = positioner.getBoundingClientRect()
    // Список снизу или (если снизу нет места) сверху триггера, но не поверх него.
    const gapBelow = list.top - trigger.bottom
    const gapAbove = trigger.top - list.bottom
    const gap = Math.max(gapBelow, gapAbove)
    expect(gap).toBeGreaterThanOrEqual(3)
    expect(gap).toBeLessThanOrEqual(6)
    // Ширина без трансформации: список на входе ещё масштабируется анимацией появления.
    expect(positioner.offsetWidth).toBeGreaterThanOrEqual(trigger.width - 1)
  })

  test('PG6: onPageChange fires on a user action, not on a programmatic slice change', async () => {
    const onPageChange = vi.fn()
    await renderPagination({ onPageChange, enableColumnSorting: true })

    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('26–50 of 1,000')
    expect(onPageChange).toHaveBeenCalledTimes(1)
    expect(onPageChange).toHaveBeenLastCalledWith(1, 25, {
      signal: expect.any(AbortSignal),
    })

    // Сортировка возвращает на первую страницу сама — это не действие с пагинацией.
    const sort = document.querySelector<HTMLElement>('.column-sort__button')!
    await userEvent.click(sort)
    await expect.poll(range).toBe('1–25 of 1,000')
    expect(onPageChange).toHaveBeenCalledTimes(1)
  })

  test('PG11: a data change keeps the page; with fewer pages the index clamps to the last one', async () => {
    const result = await renderPagination()
    await userEvent.click(pageButton('next'))
    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('51–75 of 1,000')

    await result.rerender(
      <Stories.PaginationPlayground {...GRID} dataCount={900} />,
    )
    await expect.poll(range).toBe('51–75 of 900')

    await result.rerender(
      <Stories.PaginationPlayground {...GRID} dataCount={30} />,
    )
    await expect.poll(range).toBe('26–30 of 30')
  })

  test('PG16: labels come from localization and icons from icons', async () => {
    await mount(<LocalizedGrid />)
    expect(nav()!.getAttribute('aria-label')).toBe('Страницы')
    expect(range()).toBe('1–25 из 60')
    expect(pageButton('next').getAttribute('aria-label')).toBe('Следующая')
    expect(
      pageButton('next').querySelector('[data-testid="custom-next-icon"]'),
    ).not.toBeNull()
    await expect.poll(sizeTrigger).not.toBeNull()
    expect(nav()!.textContent).toContain('Строк на странице')
  })

  test('PG12: after a page change the body is scrolled to the top', async () => {
    await renderPagination()
    const scroller = getScroller()
    scroller.scrollTo({ top: 400 })
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0)

    await userEvent.click(pageButton('next'))
    await expect.poll(range).toBe('26–50 of 1,000')
    await expect.poll(() => scroller.scrollTop).toBe(0)
  })

  test('PG13: the control is a labelled navigation; buttons are labelled, disabled ones stay focusable; the size choice has a label', async () => {
    await renderPagination()
    expect(nav()!.tagName).toBe('NAV')
    expect(nav()!.getAttribute('aria-label')).toBe(
      paginationLabels(tableLabels).pagination,
    )
    expect(
      (['first', 'previous', 'next', 'last'] as const).map(action =>
        pageButton(action).getAttribute('aria-label'),
      ),
    ).toEqual([
      paginationLabels(tableLabels).firstPage,
      paginationLabels(tableLabels).previousPage,
      paginationLabels(tableLabels).nextPage,
      paginationLabels(tableLabels).lastPage,
    ])

    const first = pageButton('first')
    expect(first.getAttribute('aria-disabled')).toBe('true')
    first.focus()
    expect(document.activeElement).toBe(first)

    await expect.poll(sizeTrigger).not.toBeNull()
    const [labelId] = sizeTrigger()!.getAttribute('aria-labelledby')!.split(' ')
    expect(document.getElementById(labelId!)!.textContent).toBe(
      paginationLabels(tableLabels).rowsPerPage,
    )
  })

  test('PG21: загруженный выбор размера страницы, как и заглушка до загрузки, назван подписью и значением', async () => {
    await renderPagination()
    await expect.poll(sizeTrigger).not.toBeNull()
    // Клик грузит модуль списка: после закрытия на месте заглушки — настоящий список.
    await userEvent.click(sizeTrigger()!)
    await expect
      .poll(() => document.querySelector('[role="listbox"]'))
      .not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect
      .poll(() => sizeTrigger()?.getAttribute('role'))
      .toBe('combobox')
    const name = (sizeTrigger()!.getAttribute('aria-labelledby') ?? '')
      .split(' ')
      .map(id => document.getElementById(id)?.textContent?.trim())
      .join(' ')
    expect(name).toBe('Rows per page 25')
  })

  test('PG14: a page change is announced in the live region: "Page N of M"', async () => {
    await renderPagination()
    await userEvent.click(pageButton('next'))
    await expect
      .poll(live)
      .toBe(paginationLabels(tableLabels).pageAnnouncement(2, 40))
    await userEvent.click(pageButton('last'))
    await expect
      .poll(live)
      .toBe(paginationLabels(tableLabels).pageAnnouncement(40, 40))
  })

  test('PG15: aria-rowcount counts rows of all pages, aria-rowindex runs through the page offset', async () => {
    await renderPagination()
    // Одна строка шапки + 1000 строк данных.
    expect(gridRoot().getAttribute('aria-rowcount')).toBe('1001')
    expect(firstRow().getAttribute('aria-rowindex')).toBe('2')

    await userEvent.click(pageButton('next'))
    await expect.poll(firstRowId).toBe('item-id-25')
    expect(firstRow().getAttribute('aria-rowindex')).toBe('27')
    expect(gridRoot().getAttribute('aria-rowcount')).toBe('1001')
  })

  test('PG17: the status bar with pagination passes axe; page buttons are at least 24×24', async () => {
    await renderPagination()
    await expect.poll(sizeTrigger).not.toBeNull()
    const wrapper = document.querySelector<HTMLElement>('.data-grid-theme')!
    const { violations } = await axe.run(wrapper, AXE_OPTIONS)
    expect(violations).toEqual([])

    for (const action of ['first', 'previous', 'next', 'last'] as const) {
      const { width, height } = pageButton(action).getBoundingClientRect()
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(24)
    }
  })

  test('PG18: after a page change the active keyboard cell keeps its column and moves to the first row', async () => {
    await renderPagination({ enableKeyboardNavigation: true })
    const target = bodyRows()
      .find(row => row.dataset.rowId === 'item-id-3')!
      .querySelectorAll<HTMLElement>('[data-kn-cell]')[1]
    const columnId = target.dataset.columnId
    expect(columnId).toBeTruthy()
    await userEvent.click(target)
    await expect.poll(() => target.dataset.knActive).toBe('true')

    await userEvent.click(pageButton('next'))
    await expect.poll(firstRowId).toBe('item-id-25')
    const active = () =>
      document.querySelector<HTMLElement>(
        '[data-kn-cell][data-kn-active="true"]',
      )
    await expect
      .poll(
        () => active()?.closest<HTMLElement>('[data-row-id]')?.dataset.rowId,
      )
      .toBe('item-id-25')
    expect(active()!.dataset.columnId).toBe(columnId)
  })
})
