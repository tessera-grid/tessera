/**
 * Охват «Выбрать всё» в клиентском режиме (ADR 0179, SE2–SE4): флажок шапки при поиске и
 * пагинации — строки после поиска на всех страницах, текущей страницы или все строки данных.
 */
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import { makeFilteringData } from '../../__mocks__/filteringData'
import { bodyRows, humanClick, revealCellButtons, Stories } from '../helpers'
import { waitForGrid } from './core-helpers'
import { tableLabels } from '../labels'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'

// 12 строк, по две на странице; поиск «Paris» оставляет 0, 5 и 10 — две страницы.
const DATA = makeFilteringData(12)
const FOUND = ['0', '5', '10']

const GRID = {
  containerHeight: 700,
  height: 620,
  maxHeight: 620,
  dataOverride: DATA,
  enableToolbar: true,
  enableQuickSearch: true,
  quickSearchDebounceMs: 0,
  quickSearchFilteredCount: false,
  columnFilteringFilteredCount: false,
  enablePagination: true,
  paginationInitialPageSize: 2,
  enableRowSelection: true,
  rowSelectionSelectedCount: true,
  enableColumnSorting: true,
}

const searchInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')!
const headCheckbox = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell [role="checkbox"]',
  )!
const next = () =>
  document.querySelector<HTMLButtonElement>('[data-page-action="next"]')!
const previous = () =>
  document.querySelector<HTMLButtonElement>('[data-page-action="previous"]')!
const pageRange = () =>
  document.querySelector('[data-testid="pagination-range"]')?.textContent
const shown = () =>
  bodyRows().map(row => row.dataset.rowId!.replace('item-id-', ''))
const checkedRows = () =>
  bodyRows()
    .filter(
      row =>
        row.querySelector('[role="checkbox"]')?.getAttribute('aria-checked') ===
        'true',
    )
    .map(row => row.dataset.rowId!.replace('item-id-', ''))
const headState = () =>
  headCheckbox().getAttribute('aria-checked') as 'true' | 'false' | 'mixed'
const count = () =>
  document
    .querySelector('[data-testid="selected-rows-count"]')
    ?.textContent?.trim() ?? ''

const renderScope = async (scope?: 'filtered' | 'currentPage' | 'all') => {
  const screen = await render(
    <Stories.FilteringPlayground
      {...GRID}
      {...(scope ? { rowSelectionSelectAll: scope } : {})}
    />,
  )
  await waitForGrid()
  await expect
    .poll(() => document.querySelector('[data-toolbar-placeholder]'))
    .toBeNull()
  await expect.poll(pageRange).toBe('1–2 of 12')
  return screen
}

const search = async (text: string) => {
  await userEvent.type(searchInput(), text)
  await expect.poll(pageRange).toBe('1–2 of 3')
}

const clearSearch = async () => {
  await userEvent.clear(searchInput())
  await expect.poll(pageRange).toBe('1–2 of 12')
}

describe('Охват «Выбрать всё» (ADR 0179)', () => {
  test('SE2: по умолчанию флажок шапки выбирает строки после поиска на всех страницах, скрытые поиском не выбираются; срез — id; «выбран» и «частично» — по тем же строкам и после смены страницы и сортировки', async () => {
    const screen = await renderScope()
    await search('Paris')
    await humanClick(headCheckbox())
    await expect.poll(checkedRows).toEqual(['0', '5'])
    expect(headState()).toBe('true')
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(FOUND.length))

    // Вторая страница выбрана тем же нажатием, флажок шапки — по всему охвату.
    await humanClick(next())
    await expect.poll(shown).toEqual(['10'])
    expect(checkedRows()).toEqual(['10'])
    expect(headState()).toBe('true')

    // Сортировка меняет порядок, а не охват.
    const name = document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="name"]',
    )!
    await revealCellButtons(name)
    await humanClick(name.querySelector<HTMLElement>('.column-sort__button')!)
    await expect.poll(pageRange).toBe('1–2 of 3')
    expect(headState()).toBe('true')

    // Снятая строка охвата — флажок шапки «частично».
    await humanClick(
      bodyRows()[0]!.querySelector<HTMLElement>('[role="checkbox"]')!,
    )
    await expect.poll(headState).toBe('mixed')

    // Без поиска выбраны только найденные строки — минус снятая.
    await clearSearch()
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(FOUND.length - 1))
    await screen.unmount()
  })

  test("SE3: охват 'currentPage' — флажок шапки выбирает строки текущей страницы после поиска", async () => {
    const screen = await renderScope('currentPage')
    await search('Paris')
    await humanClick(headCheckbox())
    await expect.poll(checkedRows).toEqual(['0', '5'])
    expect(headState()).toBe('true')

    await humanClick(next())
    await expect.poll(shown).toEqual(['10'])
    expect(checkedRows()).toEqual([])
    expect(headState()).toBe('false')
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(2))

    await humanClick(previous())
    await expect.poll(checkedRows).toEqual(['0', '5'])
    await screen.unmount()
  })

  test("SE4: охват 'all' — флажок шапки выбирает все строки данных, и скрытые поиском; счётчик называет скрытые", async () => {
    const screen = await renderScope('all')
    await search('Paris')
    await humanClick(headCheckbox())
    await expect.poll(checkedRows).toEqual(['0', '5'])
    expect(headState()).toBe('true')
    await expect
      .poll(count)
      .toBe(
        `${rowSelectionLabels(tableLabels).selectedRows(DATA.length)}, ${rowSelectionLabels(tableLabels).selectedRowsHidden(DATA.length - FOUND.length)}`,
      )

    await clearSearch()
    await expect
      .poll(count)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(DATA.length))
    expect(headState()).toBe('true')
    await screen.unmount()
  })
})
