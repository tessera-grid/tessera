import { type ComponentProps, useState } from 'react'

import axe from 'axe-core'

import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import {
  cellEditing,
  columnFiltering,
  quickSearch,
  rowSelection,
} from '../../../plugins'
import { AXE_OPTIONS } from './a11y-helpers'
import {
  filteringColumns,
  makeFilteringData,
} from '../../__mocks__/filteringData'
import { bodyRows, humanClick, Stories } from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'

// Фильтрация (ADR 0045): кнопка фильтра в заголовке, панель условия, дебаунс,
// кебаб, клавиатура. Условия по значениям (FL2, FL4–FL6, FL14, FL26) — модульные
// тесты `src/lib/__tests__/filtering.test.ts`.

// 12 строк помещаются в окно целиком: id строк — полный результат фильтра.
const DATA = makeFilteringData(12)
const ALL = DATA.map((_, i) => String(i))

const GRID = {
  containerHeight: 700,
  height: 620,
  maxHeight: 620,
  dataOverride: DATA,
}

const rowIds = () =>
  bodyRows().map(row => row.dataset.rowId!.replace('item-id-', ''))
const headCell = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )!
const filterButton = (id: string) =>
  headCell(id).querySelector<HTMLButtonElement>('.column-filter__button')
const panel = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-panel"]')
const field = (key: 'value' | 'from' | 'to') =>
  panel()?.querySelector<HTMLInputElement>(`[data-testid="filter-${key}"]`) ??
  null
const radio = (value: string) =>
  panel()!.querySelector<HTMLElement>(`[data-value="${value}"]`)!

const renderFiltering = async (args: Record<string, unknown> = {}) => {
  const screen = await render(<Stories.Filtering {...GRID} {...args} />)
  await waitForGrid()
  await expect.poll(rowIds).toEqual(ALL)
  return screen
}

/** Рендер без проверки полного набора строк (свои данные). */
const renderFilteringWith = async (args: Record<string, unknown>) => {
  const screen = await render(<Stories.Filtering {...GRID} {...args} />)
  await waitForGrid()
  return screen
}

const EDIT_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age', filter: 'number' as const },
]

const DRAG_HANDLE = '.drag__handler--column'

const openFilter = async (columnId: string) => {
  await userEvent.hover(headCell(columnId))
  await humanClick(filterButton(columnId)!)
  await expect.poll(panel).not.toBeNull()
}

const chooseOperator = async (operator: string) => {
  const item = () =>
    document.querySelector<HTMLElement>(`[data-operator="${operator}"]`)
  await humanClick(panel()!.querySelector('[data-testid="filter-operator"]')!)
  await expect.poll(item).not.toBeNull()
  await humanClick(item()!)
}

describe('Фильтрация — фильтры колонок', () => {
  test('FL3: кнопка фильтра только у колонки с filter; колонка без filter не фильтруется; фильтр идёт по значению, а не по отрисовке', async () => {
    await renderFiltering()
    for (const id of ['name', 'city', 'age', 'vip']) {
      expect(filterButton(id), id).not.toBeNull()
    }
    expect(filterButton('visits')).toBeNull()

    // VIP отрисован текстом «Yes»/«No», а фильтруется булево значение.
    await openFilter('vip')
    await humanClick(radio('yes'))
    await expect.poll(rowIds).toEqual(['0', '3', '6', '9'])
    for (const row of bodyRows()) {
      expect(
        row.querySelector('[data-column-id="vip"]')!.textContent!.trim(),
      ).toBe('Yes')
    }
  })

  test('FL7: нечисловой ввод в поле числа не применяется — поле aria-invalid с текстом ошибки', async () => {
    await renderFiltering()
    await openFilter('age')
    await userEvent.type(field('value')!, 'abc')
    await expect
      .poll(() => field('value')!.getAttribute('aria-invalid'))
      .toBe('true')
    const error = panel()!.querySelector('[role="alert"]')!
    expect(error.textContent).toBe('Enter a number')
    expect(field('value')!.getAttribute('aria-describedby')).toBe(error.id)
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(rowIds()).toEqual(ALL)

    await userEvent.clear(field('value')!)
    await userEvent.type(field('value')!, '25')
    await expect.poll(rowIds).toEqual(['1'])
    expect(field('value')!.getAttribute('aria-invalid')).toBeNull()

    // Ошибочный ввод не трогает применённый фильтр.
    await userEvent.type(field('value')!, 'x')
    await expect
      .poll(() => field('value')!.getAttribute('aria-invalid'))
      .toBe('true')
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(rowIds()).toEqual(['1'])
  })

  test('FL8: булево — «Все / Да / Нет», «Пусто» только при nullable и отбирает пустые', async () => {
    const nullable = await renderFiltering()
    await openFilter('vip')
    const values = () =>
      [...panel()!.querySelectorAll<HTMLElement>('[data-value]')].map(
        el => el.dataset.value,
      )
    expect(values()).toEqual(['all', 'yes', 'no', 'empty'])
    await humanClick(radio('empty'))
    await expect.poll(rowIds).toEqual(['8'])
    await humanClick(radio('no'))
    await expect.poll(rowIds).toEqual(['1', '2', '4', '5', '7', '10', '11'])
    await humanClick(radio('all'))
    await expect.poll(rowIds).toEqual(ALL)
    await userEvent.keyboard('{Escape}')
    await nullable.unmount()

    await renderFiltering({
      columnsOverride: filteringColumns.map(column =>
        column.id === 'vip' ? { ...column, filter: 'boolean' } : column,
      ),
    })
    await openFilter('vip')
    expect(values()).toEqual(['all', 'yes', 'no'])
  })

  test('FL9: кнопка открывает панель (условие, значение, «Сбросить»); активный фильтр виден по индикации и доступному имени; при headerActionMenu — пункт кебаба', async () => {
    const inline = await renderFiltering()
    expect(filterButton('name')!.getAttribute('aria-label')).toBe('Filter')
    await openFilter('name')
    expect(panel()!.closest('[role="dialog"]')).not.toBeNull()
    expect(
      panel()!.querySelector('[data-testid="filter-operator"]'),
    ).not.toBeNull()
    expect(field('value')).not.toBeNull()
    expect(
      panel()!.querySelector('[data-testid="filter-reset"]'),
    ).not.toBeNull()

    await userEvent.type(field('value')!, 'alice')
    await expect.poll(rowIds).toEqual(['0', '7'])
    await expect
      .poll(() => filterButton('name')!.getAttribute('aria-label'))
      .toBe('Filter, active')
    await userEvent.keyboard('{Escape}')
    await expect.poll(panel).toBeNull()
    expect(
      filterButton('name')!
        .closest('.cell__button')!
        .getAttribute('data-button-active'),
    ).toBe('true')

    await openFilter('name')
    await humanClick(panel()!.querySelector('[data-testid="filter-reset"]')!)
    await expect.poll(rowIds).toEqual(ALL)
    await expect
      .poll(() => filterButton('name')!.getAttribute('aria-label'))
      .toBe('Filter')
    await userEvent.keyboard('{Escape}')
    await inline.unmount()

    await renderFiltering({
      enableHeaderActionMenu: true,
      headerActionMenuOptions: { mode: 'always' },
    })
    expect(filterButton('name')).toBeNull()
    const kebab = headCell('name').querySelector<HTMLElement>(
      '[aria-label="Column options"]',
    )!
    await userEvent.hover(headCell('name'))
    await humanClick(kebab)
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        el => el.textContent?.trim() === 'Filter',
      )
    await expect.poll(item).toBeTruthy()
    await humanClick(item()!)
    await expect.poll(panel).not.toBeNull()
    await userEvent.type(field('value')!, 'bob')
    await expect.poll(rowIds).toEqual(['1', '8'])
  })

  test('FL10: ввод применяется через debounceMs после последнего нажатия, без промежуточных пересчётов; выбор условия — сразу', async () => {
    const DEBOUNCE = 400
    await renderFiltering({ columnFilteringOptions: { debounceMs: DEBOUNCE } })
    await openFilter('name')

    const seen = new Set<string>()
    const sampler = setInterval(() => seen.add(rowIds().join(',')), 10)
    const started = performance.now()
    await userEvent.type(field('value')!, 'carol')
    const typed = performance.now()
    expect(typed - started).toBeLessThan(DEBOUNCE)
    expect(rowIds()).toEqual(ALL)
    await expect.poll(rowIds).toEqual(['2', '9'])
    const applied = performance.now()
    clearInterval(sampler)
    seen.add(rowIds().join(','))
    expect(applied - typed).toBeGreaterThanOrEqual(DEBOUNCE - 50)
    // Только полный набор и итог — промежуточные «c», «ca»… не применялись.
    expect([...seen].sort()).toEqual([ALL.join(','), '2,9'].sort())

    await chooseOperator('empty')
    await nextFrame()
    await nextFrame()
    expect(rowIds()).toEqual([])
  })

  test.each([false, true])(
    'FL11: фокус в поле при открытии, Escape закрывает и возвращает фокус на кнопку (enableKeyboardNavigation: %s)',
    async enableKeyboardNavigation => {
      await renderFiltering({ enableKeyboardNavigation })
      await openFilter('city')
      await expect.poll(() => document.activeElement).toBe(field('value'))
      await userEvent.keyboard('{Escape}')
      await expect.poll(panel).toBeNull()
      await expect.poll(() => document.activeElement).toBe(filterButton('city'))
    },
  )
})

const searchInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
const summaryButton = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-testid="filter-summary-button"]',
  )
const summary = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-summary"]')
const filteredCount = () =>
  document.querySelector('[data-testid="filtered-rows-count"]')?.textContent ??
  null

/** Применяет фильтр текста из панели колонки и закрывает панель. */
const applyTextFilter = async (columnId: string, text: string) => {
  await openFilter(columnId)
  await userEvent.type(field('value')!, text)
  await userEvent.keyboard('{Escape}')
  await expect.poll(panel).toBeNull()
}

const TOOLBAR = {
  enableToolbar: true,
  enableQuickSearch: true,
  columnFilteringOptions: { debounceMs: 0 },
  quickSearchOptions: { debounceMs: 0 },
}

describe('Фильтрация — тулбар и нижняя панель', () => {
  test('FL1: columnFiltering и quickSearch подключаются по отдельности; без плагина или при enabled: false их UI нет и строки не фильтруются', async () => {
    const onlyColumns = await renderFiltering({
      enableToolbar: true,
      enableQuickSearch: false,
    })
    expect(filterButton('name')).not.toBeNull()
    expect(searchInput()).toBeNull()
    await applyTextFilter('name', 'alice')
    await expect.poll(rowIds).toEqual(['0', '7'])
    await onlyColumns.rerender(
      <Stories.Filtering
        {...GRID}
        enableToolbar
        enableQuickSearch={false}
        enableColumnFiltering={false}
      />,
    )
    await expect.poll(rowIds).toEqual(ALL)
    expect(filterButton('name')).toBeNull()
    expect(summaryButton()).toBeNull()
    await onlyColumns.unmount()

    const onlySearch = await renderFiltering({
      enableToolbar: true,
      enableColumnFiltering: false,
      enableQuickSearch: true,
    })
    expect(filterButton('name')).toBeNull()
    await userEvent.type(searchInput()!, 'oslo')
    await expect.poll(rowIds).toEqual(['3', '8'])
    await onlySearch.rerender(
      <Stories.Filtering
        {...GRID}
        enableToolbar
        enableColumnFiltering={false}
        enableQuickSearch={false}
      />,
    )
    await expect.poll(rowIds).toEqual(ALL)
    expect(searchInput()).toBeNull()
  })

  test('FL12: кнопка «Фильтры»: без фильтров disabled, с фильтрами — число; сводка перечисляет фильтры со сбросом каждого и «Сбросить все»', async () => {
    await renderFiltering(TOOLBAR)
    expect(summaryButton()!.getAttribute('aria-disabled')).toBe('true')
    expect(summaryButton()!.getAttribute('aria-label')).toBe('Filters')

    await applyTextFilter('name', 'a')
    await applyTextFilter('city', 'r')
    await expect
      .poll(() => summaryButton()!.getAttribute('aria-label'))
      .toBe('Filters, 2 active')
    expect(summaryButton()!.getAttribute('aria-disabled')).not.toBe('true')
    expect(summaryButton()!.textContent).toContain('2')

    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    const items = () => [...summary()!.querySelectorAll<HTMLElement>('li')]
    expect(items().map(item => item.dataset.columnId)).toEqual(['name', 'city'])
    expect(items()[0].textContent).toContain('Name')
    expect(items()[0].textContent).toContain('Contains "a"')

    await humanClick(
      items()[1].querySelector('[aria-label="Remove filter: City"]')!,
    )
    await expect.poll(() => items().length).toBe(1)
    await expect
      .poll(() => summaryButton()!.getAttribute('aria-label'))
      .toBe('Filters, 1 active')

    await humanClick(
      summary()!.querySelector('[data-testid="filter-summary-reset"]')!,
    )
    await expect.poll(rowIds).toEqual(ALL)
    await expect.poll(summary).toBeNull()
    expect(summaryButton()!.getAttribute('aria-disabled')).toBe('true')
  })

  test('FL13: фильтр скрытой колонки остаётся активным и в сводке помечен «колонка скрыта»; доступное имя называет число таких фильтров', async () => {
    await renderFiltering({ ...TOOLBAR, enableColumnVisibility: true })
    await applyTextFilter('city', 'rome')
    await expect.poll(rowIds).toEqual(['2', '7'])

    await humanClick(
      document.querySelector('[data-testid="column-visibility-button"]')!,
    )
    const cityCheckbox = () =>
      document.querySelector<HTMLElement>(
        '[data-testid="column-visibility-menu"] [data-column-id="city"] [role="checkbox"]',
      )
    await expect.poll(cityCheckbox).not.toBeNull()
    await humanClick(cityCheckbox()!)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => headCell('city')).toBeNull()
    expect(rowIds()).toEqual(['2', '7'])

    await expect
      .poll(() => summaryButton()!.getAttribute('aria-label'))
      .toBe('Filters, 1 active, 1 on hidden columns')
    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    const item = summary()!.querySelector<HTMLElement>(
      '[data-column-id="city"]',
    )!
    expect(item.hasAttribute('data-hidden-column')).toBe(true)
    expect(item.textContent).toContain('column hidden')
  })

  test('FL15: поле поиска слева в тулбаре с кнопкой очистки', async () => {
    await renderFiltering(TOOLBAR)
    const input = searchInput()!
    expect(input.getAttribute('aria-label')).toBe('Search')
    expect(input.getBoundingClientRect().right).toBeLessThan(
      summaryButton()!.getBoundingClientRect().left,
    )
    const clear = () =>
      document.querySelector<HTMLElement>('[data-testid="quick-search-clear"]')
    expect(clear()).toBeNull()

    await userEvent.type(input, 'paris')
    await expect.poll(rowIds).toEqual(['0', '5', '10'])
    expect(clear()!.getAttribute('aria-label')).toBe('Clear search')
    await humanClick(clear()!)
    await expect.poll(rowIds).toEqual(ALL)
    expect(searchInput()!.value).toBe('')
    expect(clear()).toBeNull()
  })

  test('FL16: с filteredCount — «показано N из M» при активном фильтре или поиске; без них или без опции элемента нет; при обоих плагинах — один', async () => {
    const counted = await renderFiltering({
      ...TOOLBAR,
      columnFilteringOptions: { debounceMs: 0, filteredCount: true },
      quickSearchOptions: { debounceMs: 0, filteredCount: true },
    })
    expect(filteredCount()).toBeNull()
    await applyTextFilter('name', 'alice')
    await expect.poll(filteredCount).toBe('Showing 2 of 12')
    await userEvent.type(searchInput()!, 'rome')
    await expect.poll(filteredCount).toBe('Showing 1 of 12')
    expect(
      document.querySelectorAll('[data-testid="filtered-rows-count"]'),
    ).toHaveLength(1)
    await counted.unmount()

    await renderFiltering(TOOLBAR)
    await applyTextFilter('name', 'alice')
    await expect.poll(rowIds).toEqual(['0', '7'])
    expect(filteredCount()).toBeNull()
  })

  test('FL17: счётчик выбора дописывает «N скрыто фильтром», когда выбранные строки не проходят фильтр', async () => {
    await renderFiltering({
      ...TOOLBAR,
      enableRowSelection: true,
      showSelectedCount: true,
    })
    const counter = () =>
      document.querySelector('[data-testid="selected-rows-count"]')!.textContent
    const checkbox = (rowId: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="item-id-${rowId}"] [role="checkbox"]`,
      )!
    await humanClick(checkbox('0'))
    await humanClick(checkbox('1'))
    await expect.poll(counter).toBe('2 rows selected')

    await applyTextFilter('name', 'alice')
    await expect.poll(rowIds).toEqual(['0', '7'])
    await expect.poll(counter).toBe('2 rows selected, 1 hidden by filters')

    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    await humanClick(
      summary()!.querySelector('[data-testid="filter-summary-reset"]')!,
    )
    await expect.poll(counter).toBe('2 rows selected')
  })
})

const TREE_COLUMNS = [
  {
    id: 'firstName',
    accessorKey: 'firstName',
    header: 'First Name',
    size: 200,
    filter: 'text' as const,
  },
  { id: 'country', accessorKey: 'country', header: 'Country', size: 160 },
]

// Узлы с `isGroup` раскрываются в историях; Dave → (Kate, Abobu → Thomas), Hose → Lina.
const TREE_DATA = [
  {
    id: 'item-id-0',
    firstName: 'Dave',
    country: 'USA',
    isGroup: true,
    subRows: [
      { id: 'item-id-1', firstName: 'Kate', country: 'USA' },
      {
        id: 'item-id-2',
        firstName: 'Abobu',
        country: 'France',
        isGroup: true,
        subRows: [{ id: 'item-id-3', firstName: 'Thomas', country: 'Germany' }],
      },
    ],
  },
  {
    id: 'item-id-4',
    firstName: 'Hose',
    country: 'Spain',
    isGroup: true,
    subRows: [{ id: 'item-id-5', firstName: 'Lina', country: 'Spain' }],
  },
]

const pageRange = () =>
  document.querySelector('[data-testid="pagination-range"]')?.textContent

describe('Фильтрация — сочетания с плагинами', () => {
  test('FL19: смена фильтра или поиска возвращает пагинацию на первую страницу; число страниц — по отфильтрованным строкам', async () => {
    await renderFilteringWith({
      ...TOOLBAR,
      enablePagination: true,
      paginationPageSize: 5,
    })
    const next = () =>
      document.querySelector<HTMLButtonElement>('[data-page-action="next"]')!
    await expect.poll(pageRange).toBe('1–5 of 12')
    await humanClick(next())
    await expect.poll(pageRange).toBe('6–10 of 12')

    await applyTextFilter('city', 'r')
    await expect.poll(pageRange).toBe('1–5 of 8')
    await humanClick(next())
    await expect.poll(pageRange).toBe('6–8 of 8')
    expect(next().disabled || next().getAttribute('aria-disabled')).toBeTruthy()

    await userEvent.type(searchInput()!, 'o')
    await expect.poll(pageRange).toBe('1–3 of 3')
  })

  test('FL20: выбор строк, скрытых фильтром, сохраняется и возвращается при снятии фильтра; «выбрать все» в шапке выбирает только отфильтрованные', async () => {
    await renderFiltering({ ...TOOLBAR, enableRowSelection: true })
    const checkbox = (rowId: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="item-id-${rowId}"] [role="checkbox"]`,
      )
    const checked = () =>
      bodyRows()
        .filter(
          row =>
            row
              .querySelector('[role="checkbox"]')
              ?.getAttribute('aria-checked') === 'true',
        )
        .map(row => row.dataset.rowId!.replace('item-id-', ''))
    await humanClick(checkbox('1')!)
    await expect.poll(checked).toEqual(['1'])

    await applyTextFilter('name', 'alice')
    await expect.poll(rowIds).toEqual(['0', '7'])
    const selectAll = document.querySelector<HTMLElement>(
      '.data-grid__head-cell [role="checkbox"]',
    )!
    await humanClick(selectAll)
    await expect.poll(checked).toEqual(['0', '7'])

    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    await humanClick(
      summary()!.querySelector('[data-testid="filter-summary-reset"]')!,
    )
    await expect.poll(rowIds).toEqual(ALL)
    expect(checked()).toEqual(['0', '1', '7'])
  })

  test('FL21: при непустом фильтре или поиске rowDragging инертен (ручек нет) с причиной в diagnose; при пустом — работает', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await renderFiltering({ ...TOOLBAR, enableRowDragging: true })
    const handles = () => document.querySelectorAll(DRAG_HANDLE).length
    await expect.poll(handles).toBe(12)

    await applyTextFilter('name', 'alice')
    await expect.poll(handles).toBe(0)
    expect(
      warn.mock.calls.some(call =>
        call.some(
          part =>
            String(part).includes('rowDragging') &&
            String(part).includes('filtering'),
        ),
      ),
    ).toBe(true)

    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    await humanClick(
      summary()!.querySelector('[data-testid="filter-summary-reset"]')!,
    )
    await expect.poll(handles).toBe(12)

    await userEvent.type(searchInput()!, 'bob')
    await expect.poll(handles).toBe(0)
    warn.mockRestore()
  })

  test('FL22: в дереве родитель виден, если фильтр проходит потомок', async () => {
    await renderFilteringWith({
      columnsOverride: TREE_COLUMNS,
      dataOverride: TREE_DATA,
      enableRowExpanding: true,
      initialExpanded: true,
      rowExpandingMaxDepth: 5,
    })
    await expect.poll(rowIds).toEqual(['0', '1', '2', '3', '4', '5'])

    await applyTextFilter('firstName', 'thomas')
    // Dave и Abobu сами не подходят, но их потомок Thomas — да; Kate отсеяна.
    await expect.poll(rowIds).toEqual(['0', '2', '3'])
  })

  test('FL23: группы rowGrouping собираются из отфильтрованных строк', async () => {
    await renderFilteringWith({
      enableGrouping: true,
      initialGrouping: ['city'],
    })
    const groups = () =>
      bodyRows()
        .filter(row => row.getAttribute('data-group-row') === 'true')
        .map(row => row.textContent ?? '')
    await expect.poll(() => groups().length).toBe(5)

    await applyTextFilter('name', 'alice')
    await expect.poll(() => groups().length).toBe(2)
    expect(groups().some(text => text.includes('Paris'))).toBe(true)
    expect(groups().some(text => text.includes('Rome'))).toBe(true)
  })

  test('FL24: строка, переставшая проходить фильтр после сохранения правки, уходит из выборки', async () => {
    // История не сохраняет правку в `dataOverride`: грид со своим состоянием данных.
    const EditingGrid = () => {
      const [data, setData] = useState(DATA)
      const table = useCreateTable({
        columns: EDIT_COLUMNS,
        data,
        getRowId: (row: (typeof DATA)[number]) => row.id,
        plugins: [
          columnFiltering({ debounceMs: 0 }),
          cellEditing({
            canEdit: () => true,
            onCellEdit: ({ rowId, columnId, value }) =>
              setData(prev =>
                prev.map(row =>
                  row.id === rowId
                    ? { ...row, [columnId]: Number(value) }
                    : row,
                ),
              ),
          }),
        ],
      })
      return (
        <div style={{ height: 600 }}>
          <DataGrid table={table as never} />
        </div>
      )
    }
    await render(<EditingGrid />)
    await waitForGrid()
    await openFilter('age')
    await userEvent.type(field('value')!, '25')
    await userEvent.keyboard('{Escape}')
    await expect.poll(rowIds).toEqual(['1'])

    const ageCell = () =>
      document.querySelector<HTMLElement>(
        '.data-grid__body-row[data-row-id="item-id-1"] [data-column-id="age"]',
      )!
    await userEvent.hover(ageCell())
    await humanClick(ageCell().querySelector('.cell__button button')!)
    const input = () => ageCell().querySelector<HTMLInputElement>('input')
    await expect.poll(input).not.toBeNull()
    await userEvent.clear(input()!)
    await userEvent.type(input()!, '99{Enter}')
    await expect.poll(rowIds).toEqual([])
  })
})

const DIRECT_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name', filter: 'text' as const },
  { id: 'city', accessorKey: 'city', header: 'City', filter: 'text' as const },
]

interface DirectGridProps {
  plugins: readonly unknown[]
  filterStub?: ComponentProps<typeof DataGrid>['filterStub']
  localization?: ComponentProps<typeof DataGrid>['localization']
  icons?: ComponentProps<typeof DataGrid>['icons']
  colorMode?: 'light' | 'dark'
  onTable?: (table: any) => void
}

/** Грид напрямую: пропы DataGrid, которых истории не пробрасывают. */
const DirectGrid = ({
  plugins,
  filterStub,
  localization,
  icons,
  colorMode,
  onTable,
}: DirectGridProps) => {
  const table = useCreateTable({
    columns: DIRECT_COLUMNS,
    data: DATA,
    getRowId: (row: (typeof DATA)[number]) => row.id,
    enableToolbar: true,
    plugins: plugins as never,
  })
  onTable?.(table)
  return (
    <div style={{ height: 600 }}>
      <DataGrid
        table={table as never}
        filterStub={filterStub}
        localization={localization}
        icons={icons}
        colorMode={colorMode}
      />
    </div>
  )
}

const stub = () =>
  document.querySelector<HTMLElement>('[data-testid="filter-stub"]')

describe('Фильтрация — пустой результат, сервер, доступность', () => {
  test('FL27: нет строк при активном фильтре или поиске — заглушка с кнопкой сброса фильтров и поиска; шапка остаётся; без фильтров — прежний stub', async () => {
    const screen = await renderFiltering(TOOLBAR)
    await applyTextFilter('name', 'alice')
    await userEvent.type(searchInput()!, 'zzz')
    await expect.poll(stub).not.toBeNull()
    expect(rowIds()).toEqual([])
    expect(stub()!.textContent).toContain('No rows match the filters')
    expect(filterButton('name')).not.toBeNull()

    await humanClick(
      stub()!.querySelector('[data-testid="filter-stub-reset"]')!,
    )
    await expect.poll(rowIds).toEqual(ALL)
    expect(stub()).toBeNull()
    expect(searchInput()!.value).toBe('')
    expect(summaryButton()!.getAttribute('aria-disabled')).toBe('true')
    await screen.unmount()

    // Пустые данные: строк нет, `waitForGrid` не дождётся.
    await render(<Stories.Filtering {...GRID} {...TOOLBAR} dataOverride={[]} />)
    await expect
      .poll(() => document.body.textContent?.includes('No Data!'))
      .toBe(true)
    expect(stub()).toBeNull()
  })

  test('FL28: filterStub переопределяет заглушку — узлом или функцией от { reset }', async () => {
    const plugins = [columnFiltering({ debounceMs: 0 })] as const
    const node = await render(
      <DirectGrid
        plugins={plugins}
        filterStub={<span data-testid="custom-stub">Nothing here</span>}
      />,
    )
    await waitForGrid()
    await applyTextFilter('name', 'zzz')
    await expect
      .poll(() => document.querySelector('[data-testid="custom-stub"]'))
      .not.toBeNull()
    expect(
      document.querySelector('[data-testid="filter-stub-reset"]'),
    ).toBeNull()
    await node.unmount()

    await render(
      <DirectGrid
        plugins={plugins}
        filterStub={({ reset }) => (
          <button type="button" data-testid="custom-reset" onClick={reset}>
            Start over
          </button>
        )}
      />,
    )
    await waitForGrid()
    await applyTextFilter('name', 'zzz')
    const custom = () =>
      document.querySelector<HTMLElement>('[data-testid="custom-reset"]')
    await expect.poll(custom).not.toBeNull()
    await humanClick(custom()!)
    await expect.poll(rowIds).toEqual(ALL)
  })

  test('FL29: server — грид не фильтрует; onFilterChange / onSearchChange зовутся после действия пользователя (после дебаунса), не на программную смену среза', async () => {
    const onFilterChange = vi.fn()
    const onSearchChange = vi.fn()
    let table: any
    const plugins = [
      columnFiltering({ server: true, debounceMs: 100, onFilterChange }),
      quickSearch({ server: true, debounceMs: 100, onSearchChange }),
    ] as const
    await render(<DirectGrid plugins={plugins} onTable={t => (table = t)} />)
    await waitForGrid()

    await openFilter('name')
    await userEvent.type(field('value')!, 'alice')
    expect(onFilterChange).not.toHaveBeenCalled()
    await expect.poll(() => onFilterChange.mock.calls.length).toBe(1)
    expect(onFilterChange).toHaveBeenLastCalledWith([
      { id: 'name', value: { operator: 'contains', value: 'alice' } },
    ])
    await userEvent.keyboard('{Escape}')
    expect(rowIds()).toEqual(ALL)

    await userEvent.type(searchInput()!, 'rome')
    expect(onSearchChange).not.toHaveBeenCalled()
    await expect.poll(() => onSearchChange.mock.calls.length).toBe(1)
    expect(onSearchChange).toHaveBeenLastCalledWith('rome', {
      columnIds: expect.any(Array),
    })
    expect(rowIds()).toEqual(ALL)

    table.setColumnFilters([])
    table.setGlobalFilter(undefined)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledTimes(1)
  })

  test('FL30: server — «показано N из M» из filteredRowCount / totalRowCount, без них элемента нет; «скрыто фильтром» не показывается', async () => {
    const counted = await render(
      <DirectGrid
        plugins={[
          columnFiltering({
            server: true,
            debounceMs: 0,
            filteredCount: true,
            onFilterChange: () => {},
            filteredRowCount: 3,
            totalRowCount: 40,
          }),
          rowSelection({ selectedCount: true }),
        ]}
      />,
    )
    await waitForGrid()
    const checkbox = document.querySelector<HTMLElement>(
      '.data-grid__body-row[data-row-id="item-id-1"] [role="checkbox"]',
    )!
    await humanClick(checkbox)
    await applyTextFilter('name', 'alice')
    await expect.poll(filteredCount).toBe('Showing 3 of 40')
    expect(
      document.querySelector('[data-testid="selected-rows-count"]')!
        .textContent,
    ).toBe('1 row selected')
    await counted.unmount()

    await render(
      <DirectGrid
        plugins={[
          columnFiltering({
            server: true,
            debounceMs: 0,
            filteredCount: true,
            onFilterChange: () => {},
          }),
        ]}
      />,
    )
    await waitForGrid()
    await applyTextFilter('name', 'alice')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(filteredCount()).toBeNull()
  })

  test('FL32: после применения фильтра или поиска число строк объявляется live-областью один раз', async () => {
    // Дебаунс по умолчанию: промежуточный ввод не применяется и не объявляется.
    await renderFiltering({ enableToolbar: true, enableQuickSearch: true })
    const region = document.querySelector<HTMLElement>(
      '[role="status"][aria-live="polite"]',
    )!
    const messages: string[] = []
    const observer = new MutationObserver(() => {
      const text = region.textContent ?? ''
      if (text) messages.push(text)
    })
    observer.observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    await applyTextFilter('name', 'alice')
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(messages).toEqual(['2 rows'])

    await userEvent.type(searchInput()!, 'zzz')
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(messages).toEqual(['2 rows', '0 rows'])
    observer.disconnect()
  })

  test('FL33: подписи — из localization, иконки — из icons', async () => {
    const CustomFilter = () => <svg data-testid="custom-filter-icon" />
    await render(
      <DirectGrid
        plugins={[columnFiltering({ debounceMs: 0 }), quickSearch()]}
        localization={{
          filter: 'Фильтр',
          filters: () => 'Фильтры',
          search: 'Поиск',
          filterCondition: 'Условие',
          noRowsMatchFilters: 'Ничего не найдено',
          resetFilters: 'Сбросить фильтры',
        }}
        icons={{ filter: CustomFilter }}
      />,
    )
    await waitForGrid()
    expect(filterButton('name')!.getAttribute('aria-label')).toBe('Фильтр')
    expect(
      filterButton('name')!.querySelector('[data-testid="custom-filter-icon"]'),
    ).not.toBeNull()
    expect(searchInput()!.getAttribute('aria-label')).toBe('Поиск')
    expect(summaryButton()!.getAttribute('aria-label')).toBe('Фильтры')

    await openFilter('name')
    expect(
      panel()!
        .querySelector('[data-testid="filter-operator"]')!
        .getAttribute('aria-label'),
    ).toBe('Условие')
    await userEvent.type(field('value')!, 'zzz')
    await userEvent.keyboard('{Escape}')
    await expect.poll(stub).not.toBeNull()
    expect(stub()!.textContent).toContain('Ничего не найдено')
    expect(stub()!.textContent).toContain('Сбросить фильтры')
  })

  test.each(['light', 'dark'] as const)(
    'FL34: кнопки, поповеры, поиск, сводка и заглушка проходят axe с color-contrast (%s); зона нажатия не меньше 24×24',
    async colorMode => {
      const plugins = [columnFiltering({ debounceMs: 0 }), quickSearch()]
      await render(<DirectGrid plugins={plugins} colorMode={colorMode} />)
      await waitForGrid()
      const axeOf = async (root: Element) =>
        (await axe.run(root, AXE_OPTIONS)).violations
      const wrapper = () =>
        document.querySelector<HTMLElement>('.data-grid-theme')!
      // Размер без трансформации: поповер на входе ещё масштабируется анимацией.
      const minSize = (el: Element) =>
        Math.min(
          (el as HTMLElement).offsetWidth,
          (el as HTMLElement).offsetHeight,
        )

      await userEvent.type(searchInput()!, 'a')
      await expect
        .poll(() =>
          document.querySelector('[data-testid="quick-search-clear"]'),
        )
        .not.toBeNull()
      await openFilter('name')
      await userEvent.type(field('value')!, 'alice')
      expect(await axeOf(panel()!.closest('[role="dialog"]')!)).toEqual([])
      await userEvent.keyboard('{Escape}')
      await expect.poll(panel).toBeNull()

      await humanClick(summaryButton()!)
      await expect.poll(summary).not.toBeNull()
      expect(await axeOf(summary()!)).toEqual([])
      for (const el of summary()!.querySelectorAll('button')) {
        expect(minSize(el), el.outerHTML.slice(0, 120)).toBeGreaterThanOrEqual(
          24,
        )
      }
      await userEvent.keyboard('{Escape}')
      await expect.poll(summary).toBeNull()

      expect(await axeOf(wrapper())).toEqual([])
      for (const el of [
        filterButton('name')!,
        summaryButton()!,
        document.querySelector('[data-testid="quick-search-clear"]')!,
      ]) {
        expect(minSize(el), el.outerHTML.slice(0, 120)).toBeGreaterThanOrEqual(
          24,
        )
      }

      await openFilter('city')
      await userEvent.type(field('value')!, 'zzz')
      await userEvent.keyboard('{Escape}')
      await expect.poll(stub).not.toBeNull()
      expect(await axeOf(wrapper())).toEqual([])
      expect(
        minSize(stub()!.querySelector('[data-testid="filter-stub-reset"]')!),
      ).toBeGreaterThanOrEqual(24)
    },
  )
})
