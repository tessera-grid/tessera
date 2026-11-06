import { type ComponentProps, useState } from 'react'

import axe from 'axe-core'

import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { describe, expect, test, vi } from 'vitest'

import type { DataMode } from '../../../core/dataMode'
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
import { bodyRows, humanClick, revealCellButtons, Stories } from '../helpers'
import { nextFrame, waitForGrid } from './core-helpers'
import { tokenPx } from './tree-lines-helpers'
import { tableLabels } from '../labels'
import { columnFilteringLabels } from '../../../plugins/columnFiltering/labels'
import { quickSearchLabels } from '../../../plugins/quickSearch/labels'
import { optionsLabels } from '../../../shared/options/labels'
import { filteringLabels } from '../../../shared/filtering/labels'
import { rowSelectionLabels } from '../../../plugins/rowSelection/labels'

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

/**
 * Ленивый тулбар (ADR 0061) загружен: заглушки нет. Без ожидания тест зависел бы от того,
 * успел ли модуль загрузить предыдущий тест.
 */
const waitForToolbar = () =>
  expect
    .poll(() => document.querySelector('[data-toolbar-placeholder]'))
    .toBeNull()

const renderFiltering = async (args: Record<string, unknown> = {}) => {
  const screen = await render(
    <Stories.FilteringPlayground {...GRID} {...args} />,
  )
  await waitForGrid()
  await waitForToolbar()
  await expect.poll(rowIds).toEqual(ALL)
  return screen
}

/** Рендер без проверки полного набора строк (свои данные). */
const renderFilteringWith = async (args: Record<string, unknown>) => {
  const screen = await render(
    <Stories.FilteringPlayground {...GRID} {...args} />,
  )
  await waitForGrid()
  await waitForToolbar()
  return screen
}

const EDIT_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'age', accessorKey: 'age', header: 'Age', dataType: 'number' as const },
]

const DRAG_HANDLE = '.drag__handler--column'

const openFilter = async (columnId: string) => {
  await revealCellButtons(headCell(columnId))
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
  test('FL3: кнопка фильтра — у каждой колонки с данными, вид — от типа данных колонки (ADR 0172); у колонки без данных и с enableColumnFilter: false фильтра нет; фильтруется cell.getValue(), а не отрисовка', async () => {
    // Колонка без данных и колонка с выключенным фильтром — кнопки нет.
    const own = await renderFilteringWith({
      columnsOverride: [
        ...filteringColumns.map(column =>
          column.id === 'visits'
            ? { ...column, enableColumnFilter: false }
            : column,
        ),
        { id: 'note', header: 'Note', cell: () => 'note' },
      ],
    })
    for (const id of ['name', 'city', 'age', 'vip']) {
      expect(filterButton(id), id).not.toBeNull()
    }
    expect(filterButton('visits')).toBeNull()
    expect(filterButton('note')).toBeNull()
    await own.unmount()

    // Колонка без типа — тоже с фильтром, текстовым.
    await renderFiltering()
    expect(filterButton('visits')).not.toBeNull()

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
    expect(error.textContent).toBe(
      columnFilteringLabels(tableLabels).filterInvalidNumber,
    )
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

  test('FL8: булево — «Все / Да / Нет / Пусто»; «Пусто» отбирает null и undefined (ADR 0172)', async () => {
    await renderFiltering()
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
  })

  test('FL9: кнопка открывает панель (условие, значение, «Сбросить»); активный фильтр виден по индикации и доступному имени; при headerActionMenu — пункт кебаба', async () => {
    const inline = await renderFiltering()
    expect(filterButton('name')!.getAttribute('aria-label')).toBe(
      columnFilteringLabels(tableLabels).filter,
    )
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
      .toBe(columnFilteringLabels(tableLabels).filterActive)
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
      .toBe(columnFilteringLabels(tableLabels).filter)
    await userEvent.keyboard('{Escape}')
    await inline.unmount()

    await renderFiltering({
      enableHeaderActionMenu: true,
      headerActionMenuMode: 'always',
    })
    expect(filterButton('name')).toBeNull()
    await revealCellButtons(headCell('name'))
    // Кнопку берём после наведения: заглушку кебаба сменяет кнопка из ленивого чанка.
    await humanClick(
      headCell('name').querySelector<HTMLElement>(
        `[aria-label="${tableLabels.headerMenu}"]`,
      )!,
    )
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        el =>
          el.textContent?.trim() === columnFilteringLabels(tableLabels).filter,
      )
    await expect.poll(item).toBeTruthy()
    await humanClick(item()!)
    await expect.poll(panel).not.toBeNull()
    await userEvent.type(field('value')!, 'bob')
    await expect.poll(rowIds).toEqual(['1', '8'])
  })

  test('FL10: ввод применяется через debounceMs после последнего нажатия, без промежуточных пересчётов; выбор условия — сразу', async () => {
    const DEBOUNCE = 400
    await renderFiltering({ columnFilteringDebounceMs: DEBOUNCE })
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
  // На сервере условие уходит кнопкой «Применить» (ADR 0154).
  const apply = panel()!.querySelector<HTMLElement>(
    '[data-testid="filter-apply"]',
  )
  if (apply) await humanClick(apply)
  await userEvent.keyboard('{Escape}')
  await expect.poll(panel).toBeNull()
}

/** Тулбар с поиском без задержки ввода; счётчик «показано N из M» выключен. */
const TOOLBAR = {
  enableToolbar: true,
  enableQuickSearch: true,
  columnFilteringDebounceMs: 0,
  quickSearchDebounceMs: 0,
  columnFilteringFilteredCount: false,
  quickSearchFilteredCount: false,
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
      <Stories.FilteringPlayground
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
      <Stories.FilteringPlayground
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
    expect(summaryButton()!.getAttribute('aria-label')).toBe(
      columnFilteringLabels(tableLabels).filters,
    )

    await applyTextFilter('name', 'a')
    await applyTextFilter('city', 'r')
    await expect
      .poll(() => summaryButton()!.getAttribute('aria-label'))
      .toBe(columnFilteringLabels(tableLabels).filtersActive(2))
    expect(summaryButton()!.getAttribute('aria-disabled')).not.toBe('true')
    expect(summaryButton()!.textContent).toContain('2')

    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    const items = () => [...summary()!.querySelectorAll<HTMLElement>('li')]
    expect(items().map(item => item.dataset.columnId)).toEqual(['name', 'city'])
    expect(items()[0].textContent).toContain('Name')
    expect(items()[0].textContent).toContain('Contains "a"')

    await humanClick(
      items()[1].querySelector(
        `[aria-label="${columnFilteringLabels(tableLabels).removeFilter('City')}"]`,
      )!,
    )
    await expect.poll(() => items().length).toBe(1)
    await expect
      .poll(() => summaryButton()!.getAttribute('aria-label'))
      .toBe(columnFilteringLabels(tableLabels).filtersActive(1))

    await humanClick(
      summary()!.querySelector('[data-testid="filter-summary-reset"]')!,
    )
    await expect.poll(rowIds).toEqual(ALL)
    await expect.poll(summary).toBeNull()
    expect(summaryButton()!.getAttribute('aria-disabled')).toBe('true')
  })

  test('FL43: кнопка снятия фильтра в сводке — квадратная кнопка-иконка кита: подпись — её имя и тултип, с клавиатуры — кольцо фокуса; фокус не меняет раскладку строки и не рисует линию над ней', async () => {
    await renderFiltering(TOOLBAR)
    await applyTextFilter('name', 'a')
    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    const item = summary()!.querySelector<HTMLElement>('li')!
    const remove = item.querySelector<HTMLButtonElement>(
      '[data-testid="filter-summary-remove"]',
    )!
    const label = columnFilteringLabels(tableLabels).removeFilter('Name')
    expect(remove.getAttribute('aria-label')).toBe(label)
    expect(remove.dataset.shape).toBe('square')

    const settled = (el: Element) =>
      Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished))
    await settled(summary()!)
    const before = item.getBoundingClientRect()
    const removeBefore = remove.getBoundingClientRect()
    // Фокус — клавишами: с «Сбросить фильтры» назад на крестик.
    const reset = summary()!.querySelector(
      '[data-testid="filter-summary-reset"]',
    )
    for (let i = 0; i < 5 && document.activeElement !== reset; i++)
      await userEvent.keyboard('{Tab}')
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.activeElement).toBe(remove)
    expect(remove.matches(':focus-visible')).toBe(true)
    await settled(summary()!)
    const style = getComputedStyle(remove)
    expect(style.boxShadow).toContain(
      `0px 0px 0px ${tokenPx('--tsr-comp-focus-ring-width')}px`,
    )
    expect(style.borderTopWidth).toBe('0px')
    const after = item.getBoundingClientRect()
    const removeAfter = remove.getBoundingClientRect()
    // WebKit округляет блок под фокусом до пикселя: сдвига раскладки это не значит.
    const near = (a: number, b: number) => Math.abs(a - b) <= 1
    expect(near(after.top, before.top)).toBe(true)
    expect(near(after.height, before.height)).toBe(true)
    expect([
      near(removeAfter.top, removeBefore.top),
      near(removeAfter.left, removeBefore.left),
    ]).toEqual([true, true])

    await userEvent.hover(remove)
    await expect
      .poll(() =>
        [...document.querySelectorAll('[data-side]')].some(
          el => el.textContent?.trim() === label,
        ),
      )
      .toBe(true)
    await userEvent.keyboard('{Escape}')
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
    // Меню доигрывает выход, и его подложка съела бы следующий клик.
    await expect
      .poll(() =>
        document.querySelector('[data-testid="column-visibility-menu"]'),
      )
      .toBeNull()

    await expect
      .poll(() => summaryButton()!.getAttribute('aria-label'))
      .toBe(columnFilteringLabels(tableLabels).filtersActiveHidden(1, 1))
    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    const item = summary()!.querySelector<HTMLElement>(
      '[data-column-id="city"]',
    )!
    expect(item.hasAttribute('data-hidden-column')).toBe(true)
    expect(item.textContent).toContain(
      columnFilteringLabels(tableLabels).columnHidden,
    )
  })

  test('FL15: поле поиска слева в тулбаре с кнопкой очистки', async () => {
    await renderFiltering(TOOLBAR)
    const input = searchInput()!
    expect(input.getAttribute('aria-label')).toBe(
      quickSearchLabels(tableLabels).search,
    )
    expect(input.getBoundingClientRect().right).toBeLessThan(
      summaryButton()!.getBoundingClientRect().left,
    )
    const clear = () =>
      document.querySelector<HTMLElement>('[data-testid="quick-search-clear"]')
    expect(clear()).toBeNull()

    await userEvent.type(input, 'paris')
    await expect.poll(rowIds).toEqual(['0', '5', '10'])
    expect(clear()!.getAttribute('aria-label')).toBe(
      optionsLabels(tableLabels).clearSearch,
    )
    await humanClick(clear()!)
    await expect.poll(rowIds).toEqual(ALL)
    expect(searchInput()!.value).toBe('')
    expect(clear()).toBeNull()
  })

  test('FL42: кнопки поля поиска без текста и с текстом отстоят от правого края на токен, как от верхнего и нижнего, не перекрываются, текст не заходит под них', async () => {
    await renderFiltering(TOOLBAR)
    const input = searchInput()!
    const inset = tokenPx('--tsr-comp-quick-search-button-inset')
    const button = (id: string) =>
      document
        .querySelector<HTMLElement>(`[data-testid="${id}"]`)!
        .getBoundingClientRect()
    const expectInset = (ids: string[]) => {
      const field = input.getBoundingClientRect()
      const rects = ids.map(button)
      const last = rects[rects.length - 1]
      expect(field.right - last.right).toBeCloseTo(inset, 0)
      expect(last.top - field.top).toBeCloseTo(inset, 0)
      expect(field.bottom - last.bottom).toBeCloseTo(inset, 0)
      rects
        .slice(1)
        .forEach((rect, i) =>
          expect(rect.left).toBeGreaterThanOrEqual(rects[i].right - 0.5),
        )
      const style = getComputedStyle(input)
      const textRight =
        field.right -
        parseFloat(style.borderRightWidth) -
        parseFloat(style.paddingRight)
      expect(textRight).toBeLessThanOrEqual(rects[0].left + 0.5)
    }

    expectInset(['quick-search-hint'])
    await userEvent.type(input, 'paris')
    await expect.poll(rowIds).toEqual(['0', '5', '10'])
    expectInset(['quick-search-hint', 'quick-search-clear'])
  })

  test('FL16: с filteredCount — «показано N из M» при активном фильтре или поиске; без них или без опции элемента нет; при обоих плагинах — один', async () => {
    const counted = await renderFiltering({
      ...TOOLBAR,
      columnFilteringDebounceMs: 0,
      columnFilteringFilteredCount: true,
      quickSearchDebounceMs: 0,
      quickSearchFilteredCount: true,
    })
    expect(filteredCount()).toBeNull()
    await applyTextFilter('name', 'alice')
    await expect
      .poll(filteredCount)
      .toBe(filteringLabels(tableLabels).filteredRows(2, 12))
    await userEvent.type(searchInput()!, 'rome')
    await expect
      .poll(filteredCount)
      .toBe(filteringLabels(tableLabels).filteredRows(1, 12))
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
      rowSelectionSelectedCount: true,
    })
    const counter = () =>
      document.querySelector('[data-testid="selected-rows-count"]')!.textContent
    const checkbox = (rowId: string) =>
      document.querySelector<HTMLElement>(
        `.data-grid__body-row[data-row-id="item-id-${rowId}"] [role="checkbox"]`,
      )!
    await humanClick(checkbox('0'))
    await humanClick(checkbox('1'))
    await expect
      .poll(counter)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(2))

    await applyTextFilter('name', 'alice')
    await expect.poll(rowIds).toEqual(['0', '7'])
    await expect
      .poll(counter)
      .toBe(
        `${rowSelectionLabels(tableLabels).selectedRows(2)}, ${rowSelectionLabels(tableLabels).selectedRowsHidden(1)}`,
      )

    await humanClick(summaryButton()!)
    await expect.poll(summary).not.toBeNull()
    await humanClick(
      summary()!.querySelector('[data-testid="filter-summary-reset"]')!,
    )
    await expect
      .poll(counter)
      .toBe(rowSelectionLabels(tableLabels).selectedRows(2))
  })
})

const TREE_COLUMNS = [
  {
    id: 'firstName',
    accessorKey: 'firstName',
    header: 'First Name',
    size: 200,
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
      paginationInitialPageSize: 5,
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
      enableRowGrouping: true,
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
            canEditCell: () => true,
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
    await waitForToolbar()
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
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'city', accessorKey: 'city', header: 'City' },
]

interface DirectGridProps {
  dataMode?: DataMode
  rowCount?: number
  totalRowCount?: number
  plugins: readonly unknown[]
  stubs?: ComponentProps<typeof DataGrid>['stubs']
  localization?: ComponentProps<typeof DataGrid>['localization']
  icons?: ComponentProps<typeof DataGrid>['icons']
  colorMode?: 'light' | 'dark'
  onTable?: (table: any) => void
}

/** Грид напрямую: пропы DataGrid, которых истории не пробрасывают. */
const DirectGrid = ({
  plugins,
  dataMode,
  rowCount,
  totalRowCount,
  stubs,
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
    dataMode,
    rowCount,
    totalRowCount,
    plugins: plugins as never,
  })
  onTable?.(table)
  return (
    <div style={{ height: 600 }}>
      <DataGrid
        table={table as never}
        stubs={stubs}
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
  test('FL27: нет строк при активном фильтре или поиске — заглушка с кнопкой сброса фильтров и поиска; шапка остаётся; без фильтров — заглушка «нет данных»', async () => {
    const screen = await renderFiltering(TOOLBAR)
    await applyTextFilter('name', 'alice')
    await userEvent.type(searchInput()!, 'zzz')
    await expect.poll(stub).not.toBeNull()
    expect(rowIds()).toEqual([])
    expect(stub()!.textContent).toContain(
      filteringLabels(tableLabels).noRowsMatchFilters,
    )
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
    await render(
      <Stories.FilteringPlayground {...GRID} {...TOOLBAR} dataOverride={[]} />,
    )
    await waitForToolbar()
    await expect
      .poll(() => document.querySelector('[data-testid="no-data-stub"]'))
      .not.toBeNull()
    expect(stub()).toBeNull()
  })

  test('FL41: при колонках уже грида заглушка стоит под шапкой во всю видимую ширину, а не узкой колонкой сбоку от таблицы', async () => {
    await page.viewport(1000, 800)
    const plugins = [columnFiltering({ debounceMs: 0 })] as const
    await render(<DirectGrid plugins={plugins} />)
    await waitForGrid()
    await waitForToolbar()
    await applyTextFilter('name', 'zzz')
    await expect.poll(stub).not.toBeNull()
    const container = document.querySelector<HTMLElement>(
      '.data-grid__container',
    )!
    const head = document.querySelector<HTMLElement>('.data-grid__head')!
    // Две колонки по 150px — заметно уже грида.
    const columns = [
      ...head.querySelectorAll<HTMLElement>('.data-grid__head-cell'),
    ].reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0)
    expect(columns).toBeLessThan(container.clientWidth / 2)
    const box = stub()!.getBoundingClientRect()
    const view = container.getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(
      head.getBoundingClientRect().bottom - 1,
    )
    expect(Math.abs(box.left - view.left)).toBeLessThan(2)
    expect(Math.abs(box.width - container.clientWidth)).toBeLessThan(2)
  })

  test('FL28: stubs.filtered переопределяет заглушку — узлом или функцией от { action }', async () => {
    const plugins = [columnFiltering({ debounceMs: 0 })] as const
    const node = await render(
      <DirectGrid
        plugins={plugins}
        stubs={{
          filtered: <span data-testid="custom-stub">Nothing here</span>,
        }}
      />,
    )
    await waitForGrid()
    await waitForToolbar()
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
        stubs={{
          filtered: ({ action }) => (
            <button type="button" data-testid="custom-reset" onClick={action}>
              Start over
            </button>
          ),
        }}
      />,
    )
    await waitForGrid()
    await waitForToolbar()
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
      columnFiltering({ debounceMs: 100, onFilterChange }),
      quickSearch({ debounceMs: 100, onSearchChange }),
    ] as const
    await render(
      <DirectGrid
        dataMode="server"
        plugins={plugins}
        onTable={t => (table = t)}
      />,
    )
    await waitForGrid()
    await waitForToolbar()

    await openFilter('name')
    await userEvent.type(field('value')!, 'alice')
    // Условие уходит кнопкой «Применить», не по вводу (ADR 0154).
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(onFilterChange).not.toHaveBeenCalled()
    await humanClick(
      panel()!.querySelector<HTMLElement>('[data-testid="filter-apply"]')!,
    )
    await expect.poll(() => onFilterChange.mock.calls.length).toBe(1)
    expect(onFilterChange).toHaveBeenLastCalledWith(
      [{ id: 'name', value: { operator: 'contains', value: 'alice' } }],
      { signal: expect.any(AbortSignal) },
    )
    await userEvent.keyboard('{Escape}')
    expect(rowIds()).toEqual(ALL)

    await userEvent.type(searchInput()!, 'rome')
    expect(onSearchChange).not.toHaveBeenCalled()
    await expect.poll(() => onSearchChange.mock.calls.length).toBe(1)
    expect(onSearchChange).toHaveBeenLastCalledWith(
      'rome',
      { columnIds: expect.any(Array) },
      { signal: expect.any(AbortSignal) },
    )
    expect(rowIds()).toEqual(ALL)

    table.setColumnFilters([])
    table.setGlobalFilter(undefined)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onSearchChange).toHaveBeenCalledTimes(1)
  })

  test('FL30: server — «показано N из M» из rowCount / totalRowCount таблицы, без них элемента нет; «скрыто фильтром» не показывается', async () => {
    const counted = await render(
      <DirectGrid
        dataMode={{ filtering: 'server' }}
        rowCount={3}
        totalRowCount={40}
        plugins={[
          columnFiltering({
            debounceMs: 0,
            filteredCount: true,
            onFilterChange: () => {},
          }),
          rowSelection({ selectedCount: true }),
        ]}
      />,
    )
    await waitForGrid()
    await waitForToolbar()
    const checkbox = document.querySelector<HTMLElement>(
      '.data-grid__body-row[data-row-id="item-id-1"] [role="checkbox"]',
    )!
    await humanClick(checkbox)
    await applyTextFilter('name', 'alice')
    await expect
      .poll(filteredCount)
      .toBe(filteringLabels(tableLabels).filteredRows(3, 40))
    expect(
      document.querySelector('[data-testid="selected-rows-count"]')!
        .textContent,
    ).toBe(rowSelectionLabels(tableLabels).selectedRows(1))
    await counted.unmount()

    await render(
      <DirectGrid
        dataMode={{ filtering: 'server' }}
        plugins={[
          columnFiltering({
            debounceMs: 0,
            filteredCount: true,
            onFilterChange: () => {},
          }),
        ]}
      />,
    )
    await waitForGrid()
    await waitForToolbar()
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
          'columnFiltering.filter': 'Фильтр',
          'columnFiltering.filters': 'Фильтры',
          'quickSearch.search': 'Поиск',
          'columnFiltering.filterCondition': 'Условие',
          'filtering.noRowsMatchFilters': 'Ничего не найдено',
          'filtering.resetFilters': 'Сбросить фильтры',
        }}
        icons={{ filter: CustomFilter }}
      />,
    )
    await waitForGrid()
    await waitForToolbar()
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
      await waitForToolbar()
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
