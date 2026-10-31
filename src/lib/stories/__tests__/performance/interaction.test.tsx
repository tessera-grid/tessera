import {
  constructTable,
  createCoreRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  stockFeatures,
  createExpandedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
} from '@tanstack/react-table'
import { storeReactivityBindings } from '../../../../../node_modules/@tanstack/table-core/dist/store-reactivity-bindings.js'
import { useState } from 'react'
import { cleanup, render } from 'vitest-browser-react'
import { describe, expect, test } from 'vitest'

import {
  Stories,
  getScroller,
  headCells,
  measureInteractionWork,
  measureRenderWork,
  measureScrollWork,
  measureTransitionWork,
  recordPerf,
  renderGrid,
} from '../helpers'
import {
  ALL_PLUGINS,
  CONTENT_SCROLL,
  CPU_THROTTLE_RATE,
  LARGE,
  PAGED,
  PERF_TIMEOUT,
  SMALL,
  inlineHeaderActions,
} from './perf-cases'
import {
  ANIMATION_BUDGET_MS,
  INTERACTION_BUDGET_MS,
  LOAD_BUDGET_MS,
  TBT_TARGET_MS,
} from '../perf.constants'
import { againstBase, ceilingOver, medianRun } from './baseline'
import type { MenuAction, RowAction } from '../../../core/headerActions'
import { createTesseraSortedRowModel } from '../../../plugins/columnSortingModel/sortedRowModel'
import { getTreeAria } from '../../../grid/treeAria'
import { createLazyCoreRowModel } from '../../../plugins/rowExpanding/lazyCoreRowModel'
import { createIncrementalExpandedRowModel } from '../../../shared/rowModels/expandedRowModel'
import { rowChangeHints } from '../../../core/rowChanges'
import { createSearchAwareFilteredRowModel } from '../../../shared/rowModels/filteredRowModel'
import { createIdleAwareGroupedRowModel } from '../../../plugins/rowGroupingModel/groupedRowModel'
import {
  rowExpandingLazyFeature,
  setLoadedAnswer,
} from '../../../plugins/rowExpanding/lazyChildrenFeature'
import { exportFormats } from '../../../plugins/dataExport'
import { infiniteScroll } from '../../../plugins/infiniteScroll'
import { serverRowModel } from '../../../plugins/serverRowModel'
import { pagination } from '../../../plugins/pagination'
import { rowDragging } from '../../../plugins/rowDragging'
import { moveRow } from '../../../plugins/rowDragging/moveRow'
import { cellSelection } from '../../../plugins/cellSelection'
import { rowExpanding } from '../../../plugins/rowExpanding'
import { rowGrouping } from '../../../plugins/rowGrouping'
import { columnSorting } from '../../../plugins/columnSorting'
import { useCreateTable } from '../../../core/useCreateTable'
import { DataGrid } from '../../../grid/DataGrid'
import { buildXlsx } from '../../../plugins/dataExportModel/xlsxBuild'
import { columns as mockColumns, makeColumns } from '../../__mocks__/columns'
import { getData, makeData } from '../../__mocks__/data'
import { HANDLE, beginDrag, firePointer } from '../../rowDragging.dnd'
import {
  makeOptionFilteringData,
  optionFilteringColumns,
} from '../../__mocks__/filteringData'
import { tableLabels } from '../labels'

// Отзывчивость на ВЗАИМОДЕЙСТВИЕ (INP): выбор ОДНОЙ строки меняет только
// срез rowSelection на одну запись — законной работы минимум (обновить одну строку и
// её чекбокс), поэтому всё остальное во измеренной задаче есть «лишние» ре-рендеры от
// широких подписок компонентов на весь стейт. Шаг стрелкой (keyboardNavigation)
// аналогично меняет лишь активную ячейку и пиновку строки в виртуализаторе.
// Метрика — самая длинная задача главного потока (синхронный blob
// обработчик→рендер→коммит→layout) под ×4 CPU-троттлингом; идёт в дашборд против цели
// RAIL Response без гейта (ADR 0099).

const waitForGrid = () =>
  expect.poll(() => headCells().length).toBeGreaterThan(0)

// Строка без детей: выбор строки с детьми выбрал бы и их (мок по умолчанию плоский).
const SELECT_ROW = 'item-id-1'
const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__body-row[data-row-id='${id}']`,
  )
const isRowSelected = (id: string) =>
  rowOf(id)?.getAttribute('aria-selected') === 'true'

const firstBodyCell = () =>
  document.querySelector<HTMLElement>(
    ".data-grid__body-row[data-index='0'] .data-grid__body-cell[data-kn-cell]",
  )

const clickRowCheckbox = async () => {
  rowOf(SELECT_ROW)!.querySelector<HTMLElement>('.row-select-checkbox')!.click()
}

/** Прогрев выбрал одну строку, замер снял выбор. */
const SELECT_CHECKS = {
  afterWarmup: () => {
    // Детей нет и в данных: выбор строки не выбирает потомков.
    expect(
      getData(2).find(row => row.id === SELECT_ROW)?.subRows,
    ).toBeUndefined()
    expect(isRowSelected(SELECT_ROW)).toBe(true)
    expect(
      document.querySelectorAll('.data-grid__body-row[aria-selected="true"]'),
    ).toHaveLength(1)
  },
  verify: () => expect(isRowSelected(SELECT_ROW)).toBe(false),
}

/** Индекс строки активной (в фокусе) ячейки. */
const activeRowIndex = () =>
  document.activeElement?.closest<HTMLElement>('.data-grid__body-row')?.dataset
    .index

const pressArrowDown = async () => {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    }),
  )
}

// Меню колонок (ADR 0035): кнопка тулбара → поповер с деревом на 1000 колонок.
const COLUMN_VISIBILITY = { enableToolbar: true, enableColumnVisibility: true }

const columnsButton = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="column-visibility-button"]',
  )
const columnsMenu = () =>
  document.querySelector<HTMLElement>('[data-testid="column-visibility-menu"]')
const firstColumnCheckbox = () =>
  columnsMenu()?.querySelector<HTMLElement>(
    '[data-column-id] [role="checkbox"]',
  )
const isColumnsMenuOpen = () => !!columnsMenu()?.hasAttribute('data-open')

/** Поповер грузится лениво: ждём настоящий триггер Base UI. */
const waitForColumnsButton = () =>
  expect
    .poll(() => columnsButton()?.hasAttribute('data-base-ui-click-trigger'))
    .toBe(true)

const openColumnsMenu = async () => {
  columnsButton()!.click()
  await expect.poll(() => columnsMenu()?.hasAttribute('data-open')).toBe(true)
}

const columnsSearch = () =>
  columnsMenu()!.querySelector<HTMLInputElement>('input')!

/**
 * Ввод в контролируемое поле React: нативный сеттер + событие input. Замер повторяет
 * действие — запрос чередуется: тот же текст React изменением не считает.
 */
const typeIntoSearch = async () => {
  const input = columnsSearch()
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, input.value === 'col_9' ? 'col_8' : 'col_9')
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const columnItems = () =>
  columnsMenu()?.querySelectorAll('[data-column-id]').length ?? 0

// Пагинация (ADR 0038): кнопка «вперёд» и выбор размера страницы в нижней панели.
const PAGINATION = { enablePagination: true }

const pageButton = (action: string) =>
  document.querySelector<HTMLElement>(`[data-page-action="${action}"]`)
const firstRowId = () =>
  document.querySelector<HTMLElement>(".data-grid__body-row[data-index='0']")
    ?.dataset.rowId
const pageSizeTrigger = () =>
  document.querySelector<HTMLElement>('[data-testid="page-size-select"]')
const pageSizeOption = (size: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    option => option.textContent?.trim() === size,
  )

// Экспорт (ADR 0044): «Выгрузить» в панели (строки «Все строки») сериализует всю таблицу синхронно.
const EXPORT = { enableToolbar: true, enableDataExport: true }
const EXPORT_SIZE = { columnCount: 10, dataCount: 100_000 } as const

const exportButton = () =>
  document.querySelector<HTMLElement>('[data-testid="export-button"]')
const exportRunButton = () =>
  document.querySelector<HTMLElement>('[data-testid="export-run"]')

/** Панель грузится лениво: до загрузки кнопка-заглушка по клику тоже открывает её. */
const openExportPanel = async () => {
  await expect.poll(() => exportButton()).not.toBeNull()
  exportButton()!.click()
  await expect.poll(() => exportRunButton()).not.toBeNull()
}

let exports = 0

/**
 * Скачивание в замере не нужно: подменяем клик по ссылке, сериализация остаётся.
 * Замер повторяет действие, а «Выгрузить» закрывает панель — перед повтором открываем её снова.
 */
const exportWithoutDownload = async () => {
  if (!exportRunButton()) {
    exportButton()!.click()
    await expect.poll(() => exportRunButton()).not.toBeNull()
  }
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = () => {
    exports++
  }
  try {
    exportRunButton()!.click()
  } finally {
    HTMLAnchorElement.prototype.click = click
  }
}

// Фильтрация (ADR 0045): применение поиска и фильтра колонки без дебаунса — замер
// ловит пересчёт модели и перерисовку, а не ожидание таймера.
const SEARCH = {
  enableToolbar: true,
  enableQuickSearch: true,
  quickSearchDebounceMs: 0,
}
const SEARCH_SIZE = { columnCount: 10, dataCount: 100_000 } as const
const FILTERING = {
  enableColumnFiltering: true,
  columnFilteringDebounceMs: 0,
}

/** Ввод в контролируемое поле React: нативный сеттер + событие input. */
const setInputValue = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Замер повторяет действие (прогрев + замер): значение чередуется, чтобы фильтр менялся. */
const alternate = (input: HTMLInputElement, a: string, b: string) =>
  setInputValue(input, input.value === a ? b : a)

const quickSearchInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="quick-search"]')
const filterValueInput = () =>
  document.querySelector<HTMLInputElement>('[data-testid="filter-value"]')

const openCountryFilter = async () => {
  const button = () =>
    document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="country"] .column-filter__button',
    )
  await expect.poll(button).not.toBeNull()
  button()!.click()
  await expect.poll(filterValueInput).not.toBeNull()
}

const pad = (n: number) => String(n).padStart(2, '0')
const MONTH = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
})()

/**
 * 1000×1000 с колонкой дат первой — её кнопка фильтра в окне; дни текущего месяца,
 * чтобы календарь открылся на них (ADR 0047, DF22).
 */
const DATE_FILTERING = {
  ...FILTERING,
  columnsOverride: [
    {
      id: 'registered',
      accessorKey: 'registered',
      header: 'Registered',
      filter: 'date',
      size: 150,
    },
    ...mockColumns,
    ...Array.from(
      { length: LARGE.columnCount - mockColumns.length - 1 },
      (_, i) => ({
        id: `col_${i}`,
        accessorKey: `col_${i}`,
        header: `col_${i}`,
        size: 150,
        enableResizing: true,
        enableRowGrouping: true,
        enableSorting: true,
        enablePinning: true,
        enableDragging: true,
      }),
    ),
  ],
  dataOverride: getData(LARGE.dataCount).map((row, i) => ({
    ...row,
    registered: `${MONTH}-${pad(1 + (i % 28))}`,
  })),
}

const calendarDay = (day: number) =>
  document.querySelector<HTMLElement>(
    `[data-testid="filter-calendar"] [data-day="${MONTH}-${pad(day)}"] button`,
  )

const openDateFilter = async () => {
  const button = () =>
    document.querySelector<HTMLElement>(
      '.data-grid__head-cell[data-column-id="registered"] .column-filter__button',
    )
  await expect.poll(button).not.toBeNull()
  button()!.click()
  await expect.poll(() => calendarDay(10)).not.toBeNull()
}

const isDaySelected = (day: number) =>
  document
    .querySelector(
      `[data-testid="filter-calendar"] [data-day="${MONTH}-${pad(day)}"]`,
    )
    ?.hasAttribute('data-selected') ?? false

let dateFlip = false
const toggleCalendarDay = async () => {
  dateFlip = !dateFlip
  calendarDay(dateFlip ? 10 : 20)!.click()
}

/**
 * 100 000×10 с колонкой пола — select с вариантами (ADR 0048, SF25): фильтр по ней
 * при открытой панели пересчитывает строки и фасеты остальных колонок.
 */
const OPTION_FILTERING = {
  ...FILTERING,
  columnsOverride: mockColumns.slice(0, SEARCH_SIZE.columnCount).map(column =>
    column.id === 'gender'
      ? {
          ...column,
          options: [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ],
          filter: 'select',
        }
      : column,
  ),
}

const optionCheckbox = (value: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="filter-options"] [data-value="${value}"] [role="checkbox"]`,
  )

const openOptionFilter = (columnId: string) => async () => {
  const button = () =>
    document.querySelector<HTMLElement>(
      `.data-grid__head-cell[data-column-id="${columnId}"] .column-filter__button`,
    )
  await expect.poll(button).not.toBeNull()
  button()!.click()
  await expect
    .poll(() => document.querySelector('[data-testid="filter-options"]'))
    .not.toBeNull()
}

/** 30×500 с колонкой из 1000 вариантов первой (SF26). */
const MANY_OPTIONS = Array.from({ length: 1000 }, (_, i) => ({
  value: `v${i}`,
  label: `Value ${String(i).padStart(4, '0')}`,
}))
const MANY_OPTIONS_FILTERING = {
  ...FILTERING,
  columnsOverride: [
    {
      id: 'variant',
      accessorFn: (_: unknown, index: number) => `v${(index * 37) % 1000}`,
      header: 'Variant',
      options: MANY_OPTIONS,
      filter: 'select',
      size: 150,
    },
    ...mockColumns,
    ...Array.from(
      { length: SMALL.columnCount - mockColumns.length - 1 },
      (_, i) => ({
        id: `col_${i}`,
        accessorKey: `col_${i}`,
        header: `col_${i}`,
      }),
    ),
  ],
}

const variantButton = () =>
  document.querySelector<HTMLElement>(
    '.data-grid__head-cell[data-column-id="variant"] .column-filter__button',
  )

/** Открытие панели; открытую прежде закрывает (закрытие — отдельная короткая задача). */
const reopenVariantFilter = async () => {
  if (document.querySelector('[data-testid="filter-panel"]')) {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await expect
      .poll(() => document.querySelector('[data-testid="filter-panel"]'))
      .toBeNull()
  }
  variantButton()!.click()
  await expect
    .poll(() => document.querySelector('[data-testid="filter-options"]'))
    .not.toBeNull()
}

/** Вложенная шапка с перетаскиванием групп (ADR 0052, ND14). */
const NESTED_DRAG = {
  headerNesting: 'nested',
  enableColumnDragging: true,
  enableKeyboardNavigation: true,
  dataCount: 1000,
}
const headOf = (id: string) =>
  document.querySelector<HTMLElement>(
    `.data-grid__head-cell[data-column-id="${id}"]`,
  )

/** Группа «Name» — через соседа «Info» и обратно (Alt+Shift+→/←). */
const moveNameGroup = async () => {
  const name = headOf('name')!
  const right =
    name.getBoundingClientRect().left <
    headOf('info')!.getBoundingClientRect().left
  const before = name.getBoundingClientRect().left
  name.focus()
  name.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: right ? 'ArrowRight' : 'ArrowLeft',
      altKey: true,
      shiftKey: true,
      bubbles: true,
    }),
  )
  await expect
    .poll(() => headOf('name')!.getBoundingClientRect().left)
    .not.toBe(before)
}

// Ленивые дети (ADR 0054, RE38): две корневые строки без детей в данных помечены
// `hasChildren` (мок по умолчанию плоский; строка с детьми в данных не была бы ленивой),
// `loadChildren` отдаёт заранее собранные 100 детей синхронно — замеряется приход
// ответа: пересборка исходной модели 100 000 корней и отрисовка детей. Прогрев
// раскрывает нижнюю строку, замер — верхнюю.
const LAZY_KIDS = 100
const lazyKids = (() => {
  const rows = makeData({ shape: 'flat', count: LAZY_KIDS })
  const byParent = new Map<string, unknown[]>()
  return (parentId: string) => {
    if (!byParent.has(parentId)) {
      byParent.set(
        parentId,
        rows.map((row, i) => ({ ...row, id: `${parentId}-k${i}` })),
      )
    }
    return byParent.get(parentId)!
  }
})()
const LAZY_ROOTS = ['item-id-1', 'item-id-2']
const LAZY_CHILDREN = {
  enableRowExpanding: true,
  rowExpandingHasChildren: (row: { depth: number; id: string }) =>
    row.depth === 0 && LAZY_ROOTS.includes(row.id),
  rowExpandingLoadChildren: (row: { id: string }) => lazyKids(row.id),
}
/** Замеренный приход показал детей ответа под верхней ленивой строкой. */
const expectLazyArrival = () =>
  expect(
    document.querySelector(
      `.data-grid__body-row[data-row-id='${LAZY_ROOTS[0]}-k0']`,
    ),
  ).not.toBeNull()
// Нижняя свёрнутая ленивая строка: дети прогрева не вытесняют из окна ту, что выше.
const collapsedLazyToggle = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      ".data-grid__body-row[data-expanded='false']",
    ),
  ]
    .filter(row => LAZY_ROOTS.includes(row.dataset.rowId ?? ''))
    .sort((a, b) => Number(b.dataset.index) - Number(a.dataset.index))[0]
    ?.querySelector<HTMLElement>('.row-expand-button')

interface InteractionCase {
  id: string
  label: string
  /** Подпись объёма в дашборде, если не 30×500 / 1000×1000. */
  size?: string
  args: Record<string, unknown>
  /** Подготовка вне замера (напр. фокус на ячейку). */
  prepare?: () => Promise<void>
  /** Измеряемое взаимодействие. */
  act: () => Promise<void>
  /**
   * Вне трейса после прогрева (замер повторяет то же действие): проверить, что прогрев
   * сделал измеряемое, и при нужде вернуть состояние.
   */
  afterWarmup?: () => void | Promise<void>
  /** Проверка после замера, что взаимодействие сделало то, что мерится. */
  verify?: () => void
  /** Цель класса Load вместо INP (разовая тяжёлая операция, не отклик). */
  loadBudget?: boolean
}

const CASES: InteractionCase[] = [
  {
    id: 'I1',
    label: 'выбор строки, небольшая выборка, все плагины',
    args: { ...SMALL, ...ALL_PLUGINS },
    act: clickRowCheckbox,
    ...SELECT_CHECKS,
  },
  {
    id: 'I2',
    label: 'выбор строки, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS },
    act: clickRowCheckbox,
    ...SELECT_CHECKS,
  },
  {
    id: 'I3',
    label:
      'шаг стрелкой, большая выборка, все плагины + клавиатурная навигация',
    args: { ...LARGE, ...ALL_PLUGINS, enableKeyboardNavigation: true },
    prepare: async () => {
      await expect.poll(() => firstBodyCell()).not.toBeNull()
      firstBodyCell()!.focus()
    },
    act: pressArrowDown,
    afterWarmup: () => expect(activeRowIndex()).toBe('1'),
    verify: () => expect(activeRowIndex()).toBe('2'),
  },
  {
    id: 'I4',
    label: 'скрытие колонки из меню колонок, большая выборка, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: async () => {
      await waitForColumnsButton()
      await openColumnsMenu()
    },
    act: async () => firstColumnCheckbox()!.click(),
    // Прогрев скрыл колонку, замер вернул.
    afterWarmup: () =>
      expect(firstColumnCheckbox()!.getAttribute('aria-checked')).toBe('false'),
    verify: () =>
      expect(firstColumnCheckbox()!.getAttribute('aria-checked')).toBe('true'),
  },
  {
    id: 'I5',
    label: 'открытие меню колонок на 1000 колонок, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: waitForColumnsButton,
    act: async () => columnsButton()!.click(),
    // Прогрев открыл меню; закрываем вне замера — замер мерит открытие.
    afterWarmup: async () => {
      expect(isColumnsMenuOpen()).toBe(true)
      columnsButton()!.click()
      await expect.poll(columnsMenu).toBeNull()
    },
    verify: () => expect(isColumnsMenuOpen()).toBe(true),
  },
  {
    id: 'I6',
    label: 'ввод в поиск меню колонок на 1000 колонок, все плагины',
    args: { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY },
    prepare: async () => {
      await waitForColumnsButton()
      await openColumnsMenu()
    },
    act: typeIntoSearch,
    afterWarmup: () => {
      expect(columnsSearch().value).toBe('col_9')
      expect(columnItems()).toBeLessThan(LARGE.columnCount)
    },
    verify: () => expect(columnsSearch().value).toBe('col_8'),
  },
  {
    id: 'I7',
    label:
      'переход на следующую страницу по 100 строк, 100 000 строк, все плагины',
    size: '100 000×30',
    args: {
      ...PAGED,
      ...ALL_PLUGINS,
      ...PAGINATION,
      paginationInitialPageSize: 100,
    },
    prepare: async () => {
      await expect.poll(() => pageButton('next')).not.toBeNull()
    },
    act: async () => pageButton('next')!.click(),
    afterWarmup: () => expect(firstRowId()).toBe('item-id-100'),
    verify: () => expect(firstRowId()).toBe('item-id-200'),
  },
  {
    id: 'I8',
    label: 'смена размера страницы 25 ↔ 100, 100 000 строк, все плагины',
    size: '100 000×30',
    args: { ...PAGED, ...ALL_PLUGINS, ...PAGINATION },
    prepare: async () => {
      await expect.poll(() => pageSizeTrigger()).not.toBeNull()
    },
    // Замер повторяет действие (прогрев + замер), поэтому размер чередуется;
    // открытие списка — отдельная задача, в longest не попадает.
    act: async () => {
      const next = pageSizeTrigger()!.textContent?.includes('100')
        ? '25'
        : '100'
      pageSizeTrigger()!.click()
      await expect.poll(() => pageSizeOption(next)).toBeTruthy()
      pageSizeOption(next)!.click()
      await expect.poll(() => pageSizeTrigger()!.textContent?.trim()).toBe(next)
    },
  },
  {
    id: 'FL35',
    label: 'применение быстрого поиска, 100 000×10, все плагины',
    size: '100 000×10',
    args: { ...SEARCH_SIZE, ...ALL_PLUGINS, ...SEARCH },
    prepare: async () => {
      await expect.poll(quickSearchInput).not.toBeNull()
    },
    act: async () => alternate(quickSearchInput()!, 'a', 'e'),
    afterWarmup: () => expect(quickSearchInput()!.value).toBe('a'),
    verify: () => expect(quickSearchInput()!.value).toBe('e'),
  },
  {
    id: 'FL36',
    label: 'применение фильтра колонки, большая выборка, все плагины',
    args: {
      ...LARGE,
      ...ALL_PLUGINS,
      ...FILTERING,
      ...inlineHeaderActions(makeColumns(LARGE.columnCount)),
    },
    prepare: openCountryFilter,
    act: async () => alternate(filterValueInput()!, 'a', 'e'),
    afterWarmup: () => expect(filterValueInput()!.value).toBe('a'),
    verify: () => expect(filterValueInput()!.value).toBe('e'),
  },
  {
    id: 'DF22',
    label: 'применение фильтра даты, большая выборка, все плагины',
    args: {
      ...LARGE,
      ...ALL_PLUGINS,
      ...DATE_FILTERING,
      ...inlineHeaderActions(DATE_FILTERING.columnsOverride),
    },
    prepare: openDateFilter,
    act: toggleCalendarDay,
    afterWarmup: () => expect(isDaySelected(10)).toBe(true),
    verify: () => expect(isDaySelected(20)).toBe(true),
  },
  {
    id: 'SF25',
    label: 'применение фильтра варианта с фасетами, 100 000×10, все плагины',
    size: '100 000×10',
    args: {
      ...SEARCH_SIZE,
      ...ALL_PLUGINS,
      ...OPTION_FILTERING,
      ...inlineHeaderActions(OPTION_FILTERING.columnsOverride),
    },
    prepare: openOptionFilter('gender'),
    // Прогрев отмечает «male», замер — «female»: оба щелчка применяют фильтр, а не снимают.
    act: async () =>
      optionCheckbox(
        optionCheckbox('male')!.getAttribute('aria-checked') === 'true'
          ? 'female'
          : 'male',
      )!.click(),
    afterWarmup: () =>
      expect(optionCheckbox('male')!.getAttribute('aria-checked')).toBe('true'),
    verify: () =>
      expect(optionCheckbox('female')!.getAttribute('aria-checked')).toBe(
        'true',
      ),
  },
  {
    id: 'SF26',
    label: 'открытие панели с 1000 вариантов, все плагины',
    args: {
      ...SMALL,
      ...ALL_PLUGINS,
      ...MANY_OPTIONS_FILTERING,
      ...inlineHeaderActions(MANY_OPTIONS_FILTERING.columnsOverride),
    },
    prepare: async () => {
      await expect.poll(variantButton).not.toBeNull()
    },
    act: reopenVariantFilter,
  },
  {
    id: 'EX33',
    label: 'выгрузка «Все строки», 100 000×10, все плагины',
    size: '100 000×10',
    loadBudget: true,
    args: { ...EXPORT_SIZE, ...ALL_PLUGINS, ...EXPORT },
    prepare: async () => {
      exports = 0
      await openExportPanel()
    },
    act: exportWithoutDownload,
    afterWarmup: () => expect(exports).toBe(1),
    verify: () => expect(exports).toBe(2),
  },
  {
    id: 'ND14',
    label: 'перестановка группы на вложенной шапке, 1000 строк',
    size: '1000×7 (вложенная шапка)',
    args: NESTED_DRAG,
    prepare: async () => {
      await expect.poll(() => headOf('name')).not.toBeNull()
    },
    act: moveNameGroup,
  },
  {
    id: 'RE38',
    label: 'приход 100 детей ленивой строки, 100 000×10, все плагины',
    size: '100 000×10',
    args: { ...SEARCH_SIZE, ...ALL_PLUGINS, ...LAZY_CHILDREN },
    prepare: async () => {
      await expect.poll(collapsedLazyToggle).toBeTruthy()
      LAZY_ROOTS.forEach(id => lazyKids(id))
    },
    act: async () => collapsedLazyToggle()!.click(),
    verify: expectLazyArrival,
  },
]

describe('Отзывчивость взаимодействий (INP)', () => {
  for (const c of CASES) {
    test(
      `${c.id}: ${c.label}`,
      async () => {
        renderGrid(c.args as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await c.prepare?.()

        // Нативные события (а не userEvent) — чтобы НЕ мерить тяжёлые проверки
        // видимости userEvent (getComputedStyle/checkVisibility), а только работу
        // приложения: обработчик → обновление стейта → ре-рендер → коммит.
        const result = await measureInteractionWork(c.act, {
          afterWarmup: c.afterWarmup,
        })
        c.verify?.()

        await recordPerf({
          id: c.id,
          label: c.label,
          operation: 'interaction',
          size:
            c.size ??
            (c.args.columnCount === LARGE.columnCount ? '1000×1000' : '30×500'),
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              targetMs: c.loadBudget ? LOAD_BUDGET_MS : INTERACTION_BUDGET_MS,
              ...result,
            },
          ],
        })
      },
      PERF_TIMEOUT,
    )
  }
})

// Подсветка прихода (ADR 0056, RE50): тот же приход 100 детей, что в RE38, но ответом
// сервера — отметки прихода, слой строк и объявление — против синхронного ответа без
// них. Длиннейшая задача — ожидание или приход, каждая отдельно. Каждый замер — свежий грид; прогрев раскрывает одну строку, замер — другую.
describe('Отзывчивость взаимодействий — подсветка прихода', () => {
  test(
    'RE50: приход 100 детей с подсветкой на 100 000 корней не хуже прихода без неё',
    async () => {
      const measure = async (async: boolean) => {
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          ...LAZY_CHILDREN,
          ...(async
            ? {
                // Ответ — отдельной задачей, как у сервера: ожидание и приход не
                // склеиваются в одну задачу.
                rowExpandingLoadChildren: (row: { id: string }) =>
                  new Promise(resolve =>
                    setTimeout(() => resolve(lazyKids(row.id)), 0),
                  ),
              }
            : {}),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(collapsedLazyToggle).toBeTruthy()
        LAZY_ROOTS.forEach(id => lazyKids(id))
        const result = await measureInteractionWork(async () =>
          collapsedLazyToggle()!.click(),
        )
        expectLazyArrival()
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const lit = medianRun(runs.variant, r => r.longestMs)
      // Подсветка прихода — около +20 % к синхронному приходу; запас на шум.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 40 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×10',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record(
        'RE50-base',
        'приход 100 детей синхронно, без подсветки',
        base,
        false,
      )
      await record('RE50', 'приход 100 детей промисом, с подсветкой', lit, true)

      expect(
        lit.longestMs,
        `с подсветкой longest=${lit.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Корень «Все колонки» меню (ADR 0133, HA10). «Скрыть все» — против скрытия одной
// колонки той же галочкой меню. «Показать все» убирает заглушку и монтирует таблицу
// заново — против монтирования того же грида. Замер — второе нажатие после прогрева.
const rootColumnsCheckbox = () =>
  columnsMenu()?.querySelector<HTMLElement>(
    '[data-testid="column-visibility-all"] [role="checkbox"]',
  )
const HA10_COST = { ratio: 1.3, plusMs: 40 }
const HA10_ARGS = { ...LARGE, ...ALL_PLUGINS, ...COLUMN_VISIBILITY }

const openHa10Menu = async () => {
  await renderGrid(HA10_ARGS)
  await waitForGrid()
  await waitForColumnsButton()
  await openColumnsMenu()
}

const recordHa10 = (
  id: string,
  label: string,
  r: Awaited<ReturnType<typeof measureInteractionWork>>,
  ceiling: number | undefined,
) =>
  recordPerf({
    id,
    label,
    operation: 'interaction',
    size: '1000×1000',
    plugins: 'all',
    cpuThrottle: CPU_THROTTLE_RATE,
    metrics: [
      {
        kind: 'load',
        metric: 'longest',
        valueMs: r.longestMs,
        targetMs: INTERACTION_BUDGET_MS,
        ceilingMs: ceiling,
        ...r,
      },
    ],
  })

describe('Отзывчивость — корень «Все колонки»', () => {
  test(
    'HA10: «скрыть все» корнем на 1000 колонок не дороже скрытия одной колонки, «показать все» — не дороже монтирования той же таблицы',
    async () => {
      // Прогрев скрывает, после клика вне замера — показывает, замер снова скрывает.
      const measureHide = async (isRoot: boolean) => {
        await openHa10Menu()
        const target = () =>
          (isRoot ? rootColumnsCheckbox() : firstColumnCheckbox())!
        const checked = () => target().getAttribute('aria-checked')
        target().click()
        await expect.poll(checked).toBe('false')
        const result = await measureInteractionWork(
          async () => target().click(),
          { afterWarmup: () => expect(checked()).toBe('true') },
        )
        expect(checked()).toBe('false')
        await cleanup()
        return result
      }
      const hideRuns = await againstBase(measureHide)
      const hideBase = medianRun(hideRuns.base, r => r.longestMs)
      const hideAll = medianRun(hideRuns.variant, r => r.longestMs)

      const rowsReady = () =>
        !!document.querySelector('.data-grid__body .data-grid__body-row')
      const measureShow = async (isRoot: boolean) => {
        if (!isRoot) {
          const mount = await measureRenderWork(
            () => renderGrid(HA10_ARGS),
            rowsReady,
            { warmup: false },
          )
          await cleanup()
          return mount
        }
        await openHa10Menu()
        const checked = () =>
          rootColumnsCheckbox()!.getAttribute('aria-checked')
        const result = await measureInteractionWork(
          async () => rootColumnsCheckbox()!.click(),
          { afterWarmup: () => expect(checked()).toBe('false') },
        )
        expect(checked()).toBe('true')
        expect(rowsReady()).toBe(true)
        await cleanup()
        return result
      }
      const showRuns = await againstBase(measureShow)
      const mountBase = medianRun(showRuns.base, r => r.longestMs)
      const showAll = medianRun(showRuns.variant, r => r.longestMs)
      const ceiling = {
        hide: ceilingOver(hideBase.longestMs, HA10_COST),
        show: ceilingOver(mountBase.longestMs, HA10_COST),
      }

      await recordHa10(
        'HA10-hide-base',
        'скрыть одну колонку галочкой меню',
        hideBase,
        undefined,
      )
      await recordHa10(
        'HA10-hide',
        'скрыть все колонки корнем «Все колонки»',
        hideAll,
        ceiling.hide,
      )
      await recordHa10(
        'HA10-show-base',
        'монтирование той же таблицы',
        mountBase,
        undefined,
      )
      await recordHa10(
        'HA10-show',
        'показать все колонки корнем «Все колонки» из заглушки',
        showAll,
        ceiling.show,
      )
      expect(
        hideAll.longestMs,
        `скрыть все longest=${hideAll.longestMs.toFixed(1)}ms, одна колонка ${hideBase.longestMs.toFixed(1)}ms, потолок ${ceiling.hide.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling.hide)
      expect(
        showAll.longestMs,
        `показать все longest=${showAll.longestMs.toFixed(1)}ms, монтирование ${mountBase.longestMs.toFixed(1)}ms, потолок ${ceiling.show.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling.show)
    },
    PERF_TIMEOUT * 4,
  )
})

// Скелет первой загрузки (ADR 0060, SL15): смена скелета на данные (выключение
// `loading: 'initial'`) — самая длинная задача против монтирования того же грида сразу с
// данными: смена рисует те же строки.
const SL15_COST = { ratio: 1.3, plusMs: 40 }

describe('Отзывчивость — смена скелета на данные', () => {
  test(
    'SL15: смена скелета на данные — самая длинная задача не дольше монтирования того же грида с данными',
    async () => {
      const sizes = [
        { key: 'small', size: SMALL, label: '30×500' },
        { key: 'large', size: LARGE, label: '1000×1000' },
      ] as const
      const rowsReady = () =>
        !!document.querySelector('.data-grid__body .data-grid__body-row')
      for (const { key, size, label } of sizes) {
        const args = { ...size, ...ALL_PLUGINS }
        const measureSwap = async () => {
          const screen = await renderGrid({ ...args, loading: 'initial' })
          await expect
            .poll(() => document.querySelector('.data-grid__body--skeleton'), {
              timeout: 20_000,
            })
            .toBeTruthy()
          const result = await measureTransitionWork(async () => {
            await screen.rerender(
              <Stories.DataGridPlayground
                containerHeight={600}
                height={500}
                {...args}
                loading={false}
              />,
            )
          }, rowsReady)
          await screen.unmount()
          return result
        }
        const measureMount = async () => {
          const result = await measureRenderWork(
            () => renderGrid(args),
            rowsReady,
            { warmup: false },
          )
          await cleanup()
          return result
        }
        // Прогрев JIT вне замера.
        // eslint-disable-next-line no-await-in-loop
        await measureSwap()
        // eslint-disable-next-line no-await-in-loop
        await measureMount()
        // eslint-disable-next-line no-await-in-loop
        const runs = await againstBase(swap =>
          swap ? measureSwap() : measureMount(),
        )
        const base = medianRun(runs.base, r => r.longestMs)
        const swap = medianRun(runs.variant, r => r.longestMs)
        const ceiling = ceilingOver(base.longestMs, SL15_COST)
        const record = (
          id: string,
          title: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label: `${title}, ${label}, все плагины`,
            operation: 'interaction',
            size: label,
            plugins: 'all',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: r.longestMs,
                targetMs: LOAD_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        // eslint-disable-next-line no-await-in-loop
        await record(`SL15-${key}-base`, 'монтирование с данными', base, false)
        // eslint-disable-next-line no-await-in-loop
        await record(`SL15-${key}`, 'смена скелета на данные', swap, true)
        expect(
          swap.longestMs,
          `${label}: смена ${swap.longestMs.toFixed(1)}ms, монтирование с данными ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(0)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// Сортировка по подписи (ADR 0063, OS11): первый клик сортировки колонки менеджера на
// 100 000 строк — с подписями `getOptionLabel` против той же колонки без них
// (сортировка по id). Каждый замер — свежий грид.
const OPTION_SORT_DATA = makeOptionFilteringData(100_000)
const managerColumn = (labelled: boolean) =>
  optionFilteringColumns.map(column =>
    column.id === 'managerId' && !labelled
      ? { ...column, getOptionLabel: undefined, filter: undefined }
      : column,
  )

const sortOf = (columnId: string) =>
  document
    .querySelector(`.data-grid__head-cell[data-column-id="${columnId}"]`)
    ?.getAttribute('aria-sort')

describe('Отзывчивость — сортировка по подписи', () => {
  test(
    'OS11: сортировка 100 000 строк по колонке lookup не дороже той же колонки без подписей больше чем в 1,5 раза',
    async () => {
      const measure = async (labelled: boolean) => {
        await renderGrid({
          ...ALL_PLUGINS,
          ...inlineHeaderActions(managerColumn(labelled)),
          dataOverride: OPTION_SORT_DATA,
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const button = () =>
          document.querySelector<HTMLElement>(
            '.data-grid__head-cell[data-column-id="managerId"] .column-sort__button',
          )
        await expect.poll(button).toBeTruthy()
        // Прогрев сортирует другую колонку: замер — первый клик по колонке менеджера.
        let warmed = false
        const result = await measureInteractionWork(
          async () => {
            const target = warmed ? 'managerId' : 'name'
            warmed = true
            document
              .querySelector<HTMLElement>(
                `.data-grid__head-cell[data-column-id="${target}"] .column-sort__button`,
              )!
              .click()
          },
          { afterWarmup: () => expect(sortOf('name')).not.toBe('none') },
        )
        expect([sortOf('managerId'), sortOf('name')]).toEqual([
          expect.not.stringMatching(/^none$/),
          'none',
        ])
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const labelled = medianRun(runs.variant, r => r.longestMs)
      // Подпись сравнивается Intl.Collator, id — простым сравнением: ~+20–30% (база
      // ~490–565 мс, по подписи ~655–680 мс под ×4); запас на шум замера.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.5, plusMs: 300 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×5',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('OS11-base', 'сортировка по id, без подписей', base, false)
      await record('OS11', 'сортировка по подписи', labelled, true)

      expect(
        labelled.longestMs,
        `по подписи longest=${labelled.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Своя отсортированная модель (ADR 0064, SM7): построение модели на 100 000 строк —
// смена направления сортировки и сразу модель — против createSortedRowModel TanStack
// на тех же данных. Headless-таблицы без рендера: меряется только модель.
const MODEL_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${(i * 7919) % 100_000}`,
  num: (i * 104_729) % 1000,
}))

const sortedModelTable = (factory: () => unknown) =>
  constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowSortingFeature,
      sortedRowModel: factory(),
      sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
    } as never),
    data: MODEL_ROWS,
    columns: [
      { id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' },
      { id: 'num', accessorKey: 'num', sortFn: 'basic' },
    ],
    getRowId: (row: { id: string }) => row.id,
  } as never) as unknown as {
    setSorting: (sorting: { id: string; desc: boolean }[]) => void
    getSortedRowModel: () => unknown
  }

describe('Своя отсортированная модель', () => {
  test(
    'SM7: построение модели на 100 000 строк — не дольше половины модели TanStack',
    async () => {
      const measure = async (factory: () => unknown) => {
        const table = sortedModelTable(factory)
        let desc = false
        return measureInteractionWork(async () => {
          desc = !desc
          table.setSorting([
            { id: 'name', desc },
            { id: 'num', desc: false },
          ])
          table.getSortedRowModel()
        })
      }
      const runs = await againstBase(isOurs =>
        measure(isOurs ? createTesseraSortedRowModel : createSortedRowModel),
      )
      const theirs = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = theirs.longestMs / 2
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×2',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SM7-base', 'модель TanStack', theirs, false)
      await record('SM7', 'модель Tessera', ours, true)

      expect(
        ours.longestMs,
        `Tessera longest=${ours.longestMs.toFixed(1)}ms, TanStack ${theirs.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// aria-* дерева без объекта на строку (ADR 0065, TA3): счёт на 100 000 корней со 100
// детьми у двух — как в RE38 — против прежнего алгоритма (Map по parentId, объект на
// строку) в том же замере. Счёт повторяется 10 раз за действие: один проход короче
// порога замера задачи.
const TREE_ARIA_REPEAT = 10
// Строки — настоящие строки модели TanStack: на простых объектах счёт дешевле.
type TreeAriaRow = { id: string; depth: number; parentId?: string }
// Строится в самом тесте: таблица на 100 000 строк на весь прогон файла давит на
// сборку мусора соседних кейсов.
const makeTreeAriaRows = () => {
  const data = Array.from({ length: 100_000 }, (_, i) => ({
    id: `r${i}`,
    children:
      i < 2
        ? Array.from({ length: 100 }, (_, k) => ({ id: `r${i}-${k}` }))
        : [],
  }))
  const table = constructTable({
    features: tableFeatures({
      coreReactivityFeature: storeReactivityBindings(),
      rowExpandingFeature,
      expandedRowModel: createExpandedRowModel(),
    } as never),
    data,
    columns: [{ id: 'id', accessorKey: 'id' }],
    getRowId: (row: { id: string }) => row.id,
    getSubRows: (row: { children?: unknown[] }) => row.children,
    initialState: { expanded: { r0: true, r1: true } },
  } as never) as unknown as { getRowModel: () => { rows: TreeAriaRow[] } }
  return table.getRowModel().rows
}

/** Прежний счёт тела: соседи по parentId в Map, объект атрибутов на строку. */
const treeAriaByObjects = (rows: TreeAriaRow[]) => {
  const siblings = new Map<string, TreeAriaRow[]>()
  for (const row of rows) {
    const key = row.parentId ?? ''
    const group = siblings.get(key)
    if (group) group.push(row)
    else siblings.set(key, [row])
  }
  const aria = new Map<string, object>()
  for (const group of siblings.values()) {
    group.forEach((row, index) =>
      aria.set(row.id, {
        'aria-level': row.depth + 1,
        'aria-setsize': group.length,
        'aria-posinset': index + 1,
      }),
    )
  }
  return aria
}

describe('aria-* дерева', () => {
  test(
    'TA3: счёт aria-* дерева на 100 000 строк — не дольше четверти прежнего',
    async () => {
      const rows = makeTreeAriaRows()
      const runs = await againstBase(isOurs =>
        measureInteractionWork(async () => {
          for (let i = 0; i < TREE_ARIA_REPEAT; i++) {
            if (isOurs) getTreeAria(rows)
            else treeAriaByObjects(rows)
          }
        }),
      )
      const theirs = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = theirs.longestMs / 4
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 строк',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('TA3-base', 'объект на строку', theirs, false)
      await record('TA3', 'типизированные массивы', ours, true)

      expect(
        ours.longestMs,
        `новый longest=${ours.longestMs.toFixed(1)}ms, прежний ${theirs.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT,
  )
})

// Склейка ответов (ADR 0066, RE73): пять ответов `loadChildren`, пришедших отдельными
// задачами до кадра, против одного ответа на том же гриде. Без склейки каждый ответ —
// своя пересборка модели и перерисовка; пачка — не больше двух длинных задач, а её TBT не
// больше половины пяти приходов. Ответы — промисы, которые разрешает тест.
describe('Отзывчивость взаимодействий — склейка ответов', () => {
  test(
    'RE73: пять ответов отдельными задачами на 100 000 корней — не больше двух длинных задач, TBT не больше половины пяти приходов одного ответа',
    async () => {
      /** Свежий грид: прогрев одним приходом, замер — один ответ или пачка из пяти. */
      const measure = async (isBatch: boolean) => {
        const resolvers = new Map<string, () => void>()
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          ...LAZY_CHILDREN,
          rowExpandingHasChildren: (row: { depth: number; index: number }) =>
            row.depth === 0 && row.index < 8,
          rowExpandingLoadChildren: (row: { id: string }) =>
            new Promise(resolve =>
              resolvers.set(row.id, () => resolve(lazyKids(row.id))),
            ),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const toggleOf = (id: string) =>
          document.querySelector<HTMLElement>(
            `.data-grid__body-row[data-row-id='${id}'] .row-expand-button`,
          )
        const idle = () =>
          !document.querySelector('.row-expand-button[aria-busy]')
        /** Раскрыть строки (ожидание), затем под трейсом разрешить их ответы отдельными задачами. */
        const arrive = async (ids: string[]) => {
          await expect.poll(() => ids.every(id => toggleOf(id))).toBe(true)
          ids.forEach(id => lazyKids(id))
          ids.forEach(id => toggleOf(id)!.click())
          await expect.poll(() => ids.every(id => resolvers.has(id))).toBe(true)
          // Раскрытие (модель, тело, эффекты) не попадает в замер прихода.
          for (let i = 0; i < 10; i++) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise(requestAnimationFrame)
          }
          return measureTransitionWork(async () => {
            ids.forEach(id => setTimeout(() => resolvers.get(id)!(), 0))
          }, idle)
        }
        // Прогрев: JIT пути прихода. Строки раскрываются снизу вверх — дети
        // раскрытой строки не уводят остальные из окна.
        await arrive(['item-id-7'])
        const result = await arrive(
          isBatch
            ? ['item-id-5', 'item-id-4', 'item-id-3', 'item-id-2', 'item-id-1']
            : ['item-id-6'],
        )
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const single = medianRun(runs.base, r => r.tbtMs)
      const batch = medianRun(runs.variant, r => r.tbtMs)
      // Без склейки пять ответов — пять приходов (~5× TBT); пачка — одна задача, в которую
      // может попасть сборка мусора, поэтому порог — половина пяти приходов.
      const ceiling = single.tbtMs * 2.5
      const record = (
        id: string,
        label: string,
        r: typeof single,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×10',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'tbt',
              valueMs: r.tbtMs,
              targetMs: TBT_TARGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('RE73-base', 'приход одного ответа промисом', single, false)
      await record(
        'RE73',
        'пять ответов отдельными задачами до кадра',
        batch,
        true,
      )

      expect(
        batch.tbtMs,
        `пачка TBT=${batch.tbtMs.toFixed(1)}ms (long ${batch.longTasks}), один ответ TBT=${single.tbtMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
      // Применение пачки и отрисовка её строк — до двух длинных задач; без склейки — до десяти.
      expect(
        batch.longTasks,
        `длинных задач в пачке: ${batch.longTasks}`,
      ).toBeLessThanOrEqual(2)
    },
    PERF_TIMEOUT * 6,
  )
})

// Инкрементальная исходная модель (ADR 0067, IM8): приход 100 детей у корня на 100 000
// корней — сборка модели из прежней против полной сборки TanStack на тех же данных
// (новая ссылка data — полная пересборка). Headless-таблицы без рендера со штатными
// фичами TanStack — строка платит за их инициализацию, как в гриде; ответ
// чередуется между двумя наборами детей, чтобы каждое действие его меняло.
const LAZY_MODEL_ROOTS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
}))
const lazyAnswer = (tag: string) =>
  Array.from({ length: 100 }, (_, i) => ({
    id: `r0-${tag}${i}`,
    name: `Kid ${i}`,
  }))
const LAZY_ANSWERS = [lazyAnswer('a'), lazyAnswer('b')]

describe('Инкрементальная исходная модель', () => {
  test(
    'IM8: сборка модели при приходе 100 детей на 100 000 корней — не дольше четверти полной сборки и 75 мс',
    async () => {
      const columns = [{ id: 'name', accessorKey: 'name' }]
      const getRowId = (row: { id: string }) => row.id

      const incremental = async () => {
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            rowExpandingLazyFeature,
            coreRowModel: createLazyCoreRowModel(),
          } as never),
          data: LAZY_MODEL_ROOTS,
          columns,
          getRowId,
        } as never) as unknown as { getCoreRowModel: () => unknown }
        table.getCoreRowModel()
        let turn = 0
        return measureInteractionWork(async () => {
          const kids = LAZY_ANSWERS[turn++ % 2]!
          setLoadedAnswer(table, prev => ({ ...prev, r0: kids }))
          table.getCoreRowModel()
        })
      }

      const full = async () => {
        let kids = LAZY_ANSWERS[0]!
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            coreRowModel: createCoreRowModel(),
          } as never),
          data: LAZY_MODEL_ROOTS,
          columns,
          getRowId,
          getSubRows: (row: { id: string }) =>
            row.id === 'r0' ? kids : undefined,
        } as never) as unknown as {
          getCoreRowModel: () => unknown
          options: { data: unknown }
        }
        table.getCoreRowModel()
        let turn = 0
        return measureInteractionWork(async () => {
          kids = LAZY_ANSWERS[turn++ % 2]!
          table.options.data = [...LAZY_MODEL_ROOTS]
          table.getCoreRowModel()
        })
      }

      const runs = await againstBase(isOurs =>
        isOurs ? incremental() : full(),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      // Словарь rowsById переходит новой модели без копии (ADR 0069).
      const ceiling = base.longestMs / 4
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 корней',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('IM8-base', 'полная сборка TanStack', base, false)
      await record('IM8', 'сборка из прежней модели', ours, true)

      expect(
        ours.longestMs,
        `инкремент longest=${ours.longestMs.toFixed(1)}ms, полная ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Холостые проходы (ADR 0068, PT7): фильтрация без фильтров и группировка без
// группировки на 100 000 строк — обёртки Tessera против фабрик TanStack в том же
// замере. Модель на входе чередуется между двумя готовыми исходными моделями: каждое
// действие её меняет, а сборка исходной модели в замер не входит.
const IDLE_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  city: `City ${i % 50}`,
}))

describe('Холостые проходы фильтрации и группировки', () => {
  test(
    'PT7: холостые проходы фильтрации и группировки на 100 000 строк — не дольше десятой доли проходов TanStack и 10 мс',
    async () => {
      const columns = [
        { id: 'name', accessorKey: 'name' },
        { id: 'city', accessorKey: 'city' },
      ]
      const getRowId = (row: { id: string }) => row.id
      const features = {
        ...stockFeatures,
        coreReactivityFeature: storeReactivityBindings(),
      }
      const source = constructTable({
        features: tableFeatures({
          ...features,
          coreRowModel: createCoreRowModel(),
        } as never),
        data: IDLE_ROWS,
        columns,
        getRowId,
      } as never) as unknown as {
        getCoreRowModel: () => unknown
        options: { data: unknown }
      }
      const inputs = [source.getCoreRowModel()]
      source.options.data = [...IDLE_ROWS]
      inputs.push(source.getCoreRowModel())

      const passes = async (
        filteredRowModel: unknown,
        groupedRowModel: unknown,
      ) => {
        let turn = 0
        const table = constructTable({
          features: tableFeatures({
            ...features,
            coreRowModel: () => () => inputs[turn % 2],
            filteredRowModel,
            groupedRowModel,
          } as never),
          data: IDLE_ROWS,
          columns,
          getRowId,
        } as never) as unknown as { getGroupedRowModel: () => unknown }
        table.getGroupedRowModel()
        return measureInteractionWork(async () => {
          turn++
          table.getGroupedRowModel()
        })
      }

      const runs = await againstBase(isOurs =>
        isOurs
          ? passes(
              createSearchAwareFilteredRowModel(),
              createIdleAwareGroupedRowModel(),
            )
          : passes(createFilteredRowModel(), createGroupedRowModel()),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 10
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 строк',
          plugins: 'columnFiltering, rowGrouping',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('PT7-base', 'холостые проходы TanStack', base, false)
      await record('PT7', 'холостые проходы Tessera', ours, true)

      expect(
        ours.longestMs,
        `Tessera longest=${ours.longestMs.toFixed(1)}ms, TanStack ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Инкрементальная модель раскрытия (ADR 0070, XM5): приход 100 детей у раскрытого корня
// на 100 000 корней — пересчёт модели раскрытия против фабрики TanStack в том же замере.
// Две входные модели собирает инкрементальная исходная модель (корни, кроме изменённого,
// — те же объекты); модель на входе чередуется между ними, её сборка в замер не входит.
describe('Инкрементальная модель раскрытия', () => {
  test(
    'XM5: пересчёт модели раскрытия после прихода 100 детей на 100 000 корней — не дольше четверти TanStack и 20 мс',
    async () => {
      const columns = [{ id: 'name', accessorKey: 'name' }]
      const getRowId = (row: { id: string }) => row.id
      const expanded = { r0: true, r50000: true }
      const source = constructTable({
        features: tableFeatures({
          ...stockFeatures,
          coreReactivityFeature: storeReactivityBindings(),
          rowExpandingLazyFeature,
          coreRowModel: createLazyCoreRowModel(),
        } as never),
        data: LAZY_MODEL_ROOTS,
        columns,
        getRowId,
        initialState: { expanded },
      } as never) as unknown as { getCoreRowModel: () => unknown }
      const inputs = LAZY_ANSWERS.map(kids => {
        setLoadedAnswer(source, prev => ({ ...prev, r0: kids }))
        return source.getCoreRowModel()
      })

      const recompute = async (expandedRowModel: unknown) => {
        let turn = 0
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            coreRowModel: () => () => inputs[turn % 2],
            expandedRowModel,
          } as never),
          data: LAZY_MODEL_ROOTS,
          columns,
          getRowId,
          initialState: { expanded },
        } as never) as unknown as { getExpandedRowModel: () => unknown }
        table.getExpandedRowModel()
        return measureInteractionWork(async () => {
          turn++
          table.getExpandedRowModel()
        })
      }

      const runs = await againstBase(isOurs =>
        recompute(
          isOurs
            ? createIncrementalExpandedRowModel()
            : createExpandedRowModel(),
        ),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 4
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 корней',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('XM5-base', 'модель раскрытия TanStack', base, false)
      await record('XM5', 'модель раскрытия из прошлой', ours, true)

      expect(
        ours.longestMs,
        `инкремент longest=${ours.longestMs.toFixed(1)}ms, TanStack ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Сортировка из прошлой модели (ADR 0072, SM12): приход 100 детей ленивой строки на
// 100 000 корней при активной сортировке по имени — сборка из прошлой против полной
// сортировки в том же замере. Полную вызывает смена направления на каждом действии: срез
// с тем же содержимым атом не меняет (сравнение по значению).
// Headless-таблицы со штатными фичами TanStack и ленивой исходной моделью.
const SORTED_ROOTS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${(i * 7919) % 100_000}`,
}))

describe('Сортировка из прошлой модели', () => {
  test(
    'SM12: приход 100 детей на 100 000 корней при активной сортировке — не дольше десятой доли полной сортировки и 100 мс',
    async () => {
      const sorting = [{ id: 'name', desc: false }]
      const arrival = async (full: boolean) => {
        const table = constructTable({
          features: tableFeatures({
            ...stockFeatures,
            coreReactivityFeature: storeReactivityBindings(),
            rowExpandingLazyFeature,
            coreRowModel: createLazyCoreRowModel(),
            sortedRowModel: createTesseraSortedRowModel(),
            sortFns: { alphanumeric: sortFn_alphanumeric },
          } as never),
          data: SORTED_ROOTS,
          columns: [
            { id: 'name', accessorKey: 'name', sortFn: 'alphanumeric' },
          ],
          getRowId: (row: { id: string }) => row.id,
          initialState: { sorting },
        } as never) as unknown as {
          getSortedRowModel: () => unknown
          setSorting: (next: typeof sorting) => void
        }
        table.getSortedRowModel()
        let turn = 0
        return measureInteractionWork(async () => {
          const kids = LAZY_ANSWERS[turn++ % 2]!
          setLoadedAnswer(table, prev => ({ ...prev, r0: kids }))
          if (full) table.setSorting([{ id: 'name', desc: turn % 2 === 0 }])
          table.getSortedRowModel()
        })
      }

      const runs = await againstBase(isOurs => arrival(!isOurs))
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      const ceiling = base.longestMs / 10
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000 корней',
          plugins: 'rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SM12-base', 'приход с полной сортировкой', base, false)
      await record('SM12', 'приход с сортировкой из прошлой', ours, true)

      expect(
        ours.longestMs,
        `из прошлой longest=${ours.longestMs.toFixed(1)}ms, полная ${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Сборка .xlsx (ADR 0073, XL11): 100 000 × 10 — генератор кусками с отдачей потока и
// сжатием вне его против CSV того же объёма в том же замере. Сбор данных из таблицы
// общий для форматов и в замер не входит.
const XLSX_COLUMNS = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i}`,
  header: `Column ${i}`,
  size: 120,
  ...(i === 3 ? { filter: 'date' } : {}),
}))
const XLSX_ROWS = Array.from({ length: 100_000 }, (_, r) =>
  XLSX_COLUMNS.map((_, c) =>
    c === 0
      ? `Name ${r}`
      : c === 3
        ? `2026-${String((r % 12) + 1).padStart(2, '0')}-15`
        : c % 2
          ? r * c
          : `Value ${r % 97}`,
  ),
)

describe('Экспорт в Excel', () => {
  test(
    'XL11: сборка .xlsx 100 000 × 10 — самая длинная задача главного потока не дольше половины синхронной сборки CSV того же объёма',
    async () => {
      const data = { columns: XLSX_COLUMNS, rows: XLSX_ROWS }
      let csvSize = 0
      let xlsxSize = 0
      const runs = await againstBase(isXlsx =>
        measureInteractionWork(async () => {
          if (isXlsx) xlsxSize = (await buildXlsx(data)).size
          else csvSize = exportFormats.csv().serialize(data).length
        }),
      )
      expect(csvSize).toBeGreaterThan(0)
      expect(xlsxSize).toBeGreaterThan(0)
      const base = medianRun(runs.base, r => r.longestMs)
      const ours = medianRun(runs.variant, r => r.longestMs)
      // Генератор отдаёт поток по частям: его самая длинная задача короче синхронной
      // сборки CSV того же объёма.
      const ceiling = base.longestMs / 2
      const record = (
        id: string,
        label: string,
        r: typeof ours,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×10',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('XL11-base', 'сериализация CSV', base, false)
      await record('XL11', 'сборка .xlsx кусками', ours, true)

      expect(
        ours.longestMs,
        `xlsx longest=${ours.longestMs.toFixed(1)}ms tbt=${ours.tbtMs.toFixed(1)}ms, csv longest=${base.longestMs.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 4,
  )
})

// Вложенные разделы меню (ADR 0079, NM18): вход в раздел со 100 пунктами из кебаба
// строки — против открытия кебаба с плоским меню из тех же 100 пунктов; возврат на
// корень — против открытия кебаба с корневым меню (ADR 0099, §1а).
const NM18_COST = { ratio: 1.3, plusMs: 20 }

describe('Отзывчивость — разделы меню', () => {
  test(
    'NM18: вход в раздел со 100 пунктами не дороже открытия плоского меню из них; возврат на корень не дороже открытия корневого меню',
    async () => {
      const leaves: MenuAction[] = Array.from({ length: 100 }, (_, i) => ({
        id: `perfLeaf${i}`,
        icon: () => null,
        label: () => `Destination ${i}`,
        onSelect: () => {},
      }))
      const section: RowAction = {
        id: 'perfSection',
        slot: 'actionRowSlot',
        order: 0,
        icon: () => null,
        label: () => 'Move to',
        onSelect: () => {},
        submenu: () => ({ title: 'Move to', items: leaves }),
      }
      const flat: RowAction[] = leaves.map((leaf, order) => ({
        ...leaf,
        slot: 'actionRowSlot',
        order,
      }))

      const menuItem = (label: string) =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          el => el.querySelector('[class*="itemLabel"]')?.textContent === label,
        )
      const items = () => document.querySelectorAll('[role="menuitem"]').length
      const backRow = () =>
        document.querySelector<HTMLElement>('[data-menu-back]')
      const kebab = () =>
        document.querySelector<HTMLElement>(
          `[aria-label^="${tableLabels.rowMenu}"]`,
        )
      const inSection = () => menuItem('Destination 99') !== undefined
      const closeMenu = async () => {
        ;(document.activeElement as HTMLElement | null)?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        )
        await expect.poll(items).toBe(0)
      }
      const mount = async (actions: RowAction[]) => {
        const screen = renderGrid({
          ...SMALL,
          enableRowActions: true,
          enableRowActionMenu: true,
          extraPlugins: [{ id: 'perfSections', slotActions: actions }],
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        await expect.poll(kebab).not.toBeNull()
        return screen
      }
      /** Открытие кебаба: меню, в котором есть пункт `last`. */
      const openKebab = async (actions: RowAction[], last: string) => {
        const open = () => menuItem(last) !== undefined
        const screen = await mount(actions)
        const result = await measureInteractionWork(
          async () => kebab()!.click(),
          {
            afterWarmup: async () => {
              expect(open()).toBe(true)
              await closeMenu()
            },
          },
        )
        expect(open()).toBe(true)
        ;(await screen).unmount()
        return result
      }
      const enter = async () => {
        const screen = await mount([section])
        kebab()!.click()
        await expect.poll(() => menuItem('Move to')).toBeTruthy()
        const result = await measureInteractionWork(
          async () => menuItem('Move to')!.click(),
          {
            afterWarmup: async () => {
              expect(inSection()).toBe(true)
              backRow()!.click()
              await expect.poll(inSection).toBe(false)
            },
          },
        )
        expect(inSection()).toBe(true)
        ;(await screen).unmount()
        return result
      }
      const back = async () => {
        const screen = await mount([section])
        kebab()!.click()
        await expect.poll(() => menuItem('Move to')).toBeTruthy()
        menuItem('Move to')!.click()
        await expect.poll(inSection).toBe(true)
        const result = await measureInteractionWork(
          async () => backRow()!.click(),
          {
            afterWarmup: async () => {
              expect(inSection()).toBe(false)
              menuItem('Move to')!.click()
              await expect.poll(inSection).toBe(true)
            },
          },
        )
        expect(inSection()).toBe(false)
        ;(await screen).unmount()
        return result
      }

      const pairs = [
        {
          record: 'NM18',
          label: 'вход в раздел со 100 пунктами',
          baseLabel: 'открытие плоского меню из 100 пунктов',
          runs: await againstBase(isSection =>
            isSection ? enter() : openKebab(flat, 'Destination 99'),
          ),
        },
        {
          record: 'NM18-back',
          label: 'возврат из раздела со 100 пунктами',
          baseLabel: 'открытие корневого меню',
          runs: await againstBase(isBack =>
            isBack ? back() : openKebab([section], 'Move to'),
          ),
        },
      ]
      for (const { record: id, label, baseLabel, runs } of pairs) {
        const base = medianRun(runs.base, r => r.longestMs)
        const variant = medianRun(runs.variant, r => r.longestMs)
        const ceiling = ceilingOver(base.longestMs, NM18_COST)
        for (const [recordId, recordLabel, result, gated] of [
          [`${id}-base`, baseLabel, base, false],
          [id, label, variant, true],
        ] as const) {
          // eslint-disable-next-line no-await-in-loop
          await recordPerf({
            id: recordId,
            label: recordLabel,
            operation: 'interaction',
            size: '30×500',
            plugins: 'rowActions',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: result.longestMs,
                targetMs: INTERACTION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...result,
              },
            ],
          })
        }
        expect
          .soft(
            variant.longestMs,
            `${id} longest=${variant.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
          )
          .toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 6,
  )
})

// Лента (ADR 0081, IS16): ответ дописывает 100 строк к 100 000 загруженным — новая
// `data` и полная пересборка модели (инкрементальные модели этот случай не покрывают)
// плюс проверка края лентой — против подмены `data` той же длины на том же гриде.
interface FeedRow {
  id: string
  a: string
  b: number
  c: string
}
const feedRows = (from: number, count: number): FeedRow[] =>
  Array.from({ length: count }, (_, k) => ({
    id: `f${from + k}`,
    a: `Name ${from + k}`,
    b: from + k,
    c: `City ${(from + k) % 50}`,
  }))
const FEED_COLUMNS = [
  { id: 'a', accessorKey: 'a', header: 'A', size: 200 },
  { id: 'b', accessorKey: 'b', header: 'B', size: 120 },
  { id: 'c', accessorKey: 'c', header: 'C', size: 200 },
]
let setFeedRows: (update: (prev: FeedRow[]) => FeedRow[]) => void
let feedLength = 0
const FeedGrid = ({ initial }: { initial: FeedRow[] }) => {
  const [rows, setRows] = useState(initial)
  setFeedRows = setRows
  feedLength = rows.length
  const table = useCreateTable({
    columns: FEED_COLUMNS as never,
    data: rows,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      infiniteScroll({
        hasMore: true,
        onLoadMore: () => new Promise<void>(() => {}),
      }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Дописать 100 строк к 100 000 в ленте или подменить `data` той же длины. */
const measureFeed = async (append: boolean) => {
  const initial = feedRows(0, 100_000)
  await render(<FeedGrid initial={initial} />)
  await waitForGrid()
  const result = await measureInteractionWork(
    async () => {
      setFeedRows(prev =>
        append ? prev.concat(feedRows(prev.length, 100)) : prev.slice(),
      )
    },
    {
      afterWarmup: () =>
        expect
          .poll(
            () => document.querySelectorAll('.data-grid__body-row').length > 0,
          )
          .toBe(true),
    },
  )
  // Прогрев и замер — по действию: дописано дважды по 100 строк.
  await expect.poll(() => feedLength).toBe(append ? 100_200 : 100_000)
  await cleanup()
  return result
}

describe('Отзывчивость взаимодействий — лента', () => {
  test(
    'IS16: дописать блок из 100 строк к 100 000 не хуже подмены data той же длины',
    async () => {
      // Самая длинная задача одного ответа на 100 000 строк шумит на ±40 мс: пять раундов.
      const runs = await againstBase(measureFeed, 5)
      const base = medianRun(runs.base, r => r.longestMs)
      const fed = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.15, plusMs: 40 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×3',
          plugins: 'infiniteScroll',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('IS16-base', 'подмена data той же длины', base, false)
      await record('IS16', 'дописать 100 строк к 100 000', fed, true)
      expect(
        fed.longestMs,
        `дописать longest=${fed.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Длинный текст (ADR 0083, TX12): открытие кебаба строки с 20 пунктами, подписи
// которых переносятся на несколько строк, против тех же пунктов с короткими подписями.
const TX12_COST = { ratio: 1.3, plusMs: 20 }

describe('Отзывчивость — длинные подписи меню', () => {
  test(
    'TX12: открытие меню с 20 длинными пунктами не дороже меню с короткими',
    async () => {
      const measure = async (long: boolean) => {
        const actions: RowAction[] = Array.from({ length: 20 }, (_, i) => ({
          id: `textAction${i}`,
          slot: 'actionRowSlot',
          order: i,
          icon: () => null,
          label: () =>
            long
              ? `Action ${i}: reassign the account to another manager in the same regional office`
              : `Action ${i}`,
          onSelect: () => {},
        }))
        const screen = renderGrid({
          ...SMALL,
          enableRowActions: true,
          enableRowActionMenu: true,
          actionsDemo: 'none',
          extraPlugins: [{ id: 'textActions', slotActions: actions }],
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const kebab = () =>
          document.querySelector<HTMLElement>(
            `[aria-label^="${tableLabels.rowMenu}"]`,
          )
        const open = () =>
          document.querySelectorAll('[role="menuitem"]').length === 20
        await expect.poll(kebab).not.toBeNull()
        const result = await measureInteractionWork(
          async () => kebab()!.click(),
          {
            afterWarmup: async () => {
              expect(open()).toBe(true)
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
              )
              ;(document.activeElement as HTMLElement | null)?.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
              )
              await expect.poll(open).toBe(false)
            },
          },
        )
        expect(open()).toBe(true)
        if (long) {
          const label = document.querySelector('[class*="itemLabel"]')!
          expect(label.getBoundingClientRect().height).toBeGreaterThan(
            parseFloat(getComputedStyle(label).lineHeight) * 1.5,
          )
        }
        ;(await screen).unmount()
        return result
      }

      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const long = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, TX12_COST)
      for (const [id, label, result, gated] of [
        ['TX12-base', 'меню из 20 коротких пунктов', base, false],
        ['TX12', 'меню из 20 пунктов с переносом подписи', long, true],
      ] as const) {
        await recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '30×500',
          plugins: 'rowActions',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: result.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...result,
            },
          ],
        })
      }
      expect(
        long.longestMs,
        `TX12 longest=${long.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 4,
  )
})

// Прокрутка к строке (ADR 0104, SV11): `table.scrollToRow` к строке в середине 100 000
// строк против прямого `scrollTo` на то же место. Прогрев — к строке 30 000, замер — к
// 60 000; оба по началу окна тела.
const SCROLL_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
}))
const SCROLL_COLUMNS = [{ id: 'name', accessorKey: 'name', header: 'Name' }]

describe('Отзывчивость — прокрутка к строке', () => {
  test(
    'SV11: прокрутка к строке в середине 100 000 строк не дороже прямой установки scrollTop на ту же позицию больше чем на 30 % или 4 мс',
    async () => {
      const measure = async (variant: boolean) => {
        let table:
          | {
              scrollToRow: (
                id: string,
                options?: { align?: 'start' },
              ) => Promise<boolean>
            }
          | undefined
        const ScrollGrid = () => {
          const created = useCreateTable({
            columns: SCROLL_COLUMNS as never,
            data: SCROLL_ROWS,
            getRowId: (row: { id: string }) => row.id,
            plugins: [],
          })
          table = created as never
          return (
            <div style={{ width: 600, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<ScrollGrid />)
        await waitForGrid()
        const scroller = document.querySelector<HTMLElement>(
          '.data-grid__container',
        )!
        const rowHeight = document
          .querySelector('.data-grid__body-row')!
          .getBoundingClientRect().height
        const mounted = (index: number) =>
          document.querySelector(
            `.data-grid__body-row[data-row-id="r${index}"]`,
          )
        let target = 30_000
        const result = await measureInteractionWork(
          async () => {
            const index = target
            target = 60_000
            if (variant) {
              expect(
                await table!.scrollToRow(`r${index}`, { align: 'start' }),
              ).toBe(true)
            } else {
              scroller.scrollTo({ top: index * rowHeight, behavior: 'instant' })
              await expect.poll(() => mounted(index)).not.toBeNull()
            }
          },
          { afterWarmup: () => expect(mounted(30_000)).not.toBeNull() },
        )
        expect(mounted(60_000)).not.toBeNull()
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const scrolled = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 4 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×1',
          plugins: 'none',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SV11-base', 'прямой scrollTo на ту же позицию', base, false)
      await record('SV11', 'scrollToRow к строке 60 000', scrolled, true)

      expect(
        scrolled.longestMs,
        `scrollToRow longest=${scrolled.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Движение строк (ADR 0107, RM20): цена FLIP против той же смены без движения —
// сортировка 100 000 строк (отзывчивость), раскрытие 100 детей на 1000×1000 (кадры во
// время движения) и спокойная прокрутка 1000×1000 без смены модели.
const MOTION_ROWS = Array.from({ length: 100_000 }, (_, i) => ({
  id: `r${i}`,
  name: `Name ${i}`,
  rank: (i * 7919) % 100_000,
}))
const MOTION_COLUMNS = [
  { id: 'name', accessorKey: 'name', header: 'Name' },
  { id: 'rank', accessorKey: 'rank', header: 'Rank' },
]
/** Цена движения по ADR 0107, RM20: сортировка платит за копии уходящих строк. */
const RM20_COST = { ratio: 1.3, plusMs: 8 }
/** Раскрытие: призраки группами и проявление детей, цена на 2026-10-16 с запасом (RM31). */
const RM20_EXPAND_COST = { ratio: 1.3, plusMs: 18 }
const RM20_SORT_COST = { ratio: 1.45, plusMs: 8 }
const MOTION_SETTLE_MS = 400

const motionTree = () => {
  const rows = getData(1000)
  rows[0].subRows = getData(100).map((row: { id: string }) => ({
    ...row,
    id: `${rows[0].id}-${row.id}`,
  }))
  return rows
}

describe('Отзывчивость — движение строк', () => {
  test(
    'RM20: движение строк против той же смены без него — сортировка 100 000 строк до +45 % или 8 мс, раскрытие 100 детей на 1000×1000 до +30 % или 18 мс, спокойная прокрутка до +30 % или 8 мс',
    async () => {
      // Сортировка 100 000 строк: в окне уцелевает строка r0 (rank 0) — движение есть.
      const sort = async (motion: boolean) => {
        let table:
          | { setSorting: (sorting: { id: string; desc: boolean }[]) => void }
          | undefined
        const SortGrid = () => {
          const created = useCreateTable({
            columns: MOTION_COLUMNS as never,
            data: MOTION_ROWS,
            getRowId: (row: { id: string }) => row.id,
            plugins: [columnSorting()],
            enableRowAnimation: motion,
          })
          table = created as never
          return (
            <div style={{ width: 600, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<SortGrid />)
        await waitForGrid()
        const firstId = () =>
          document
            .querySelector('.data-grid__body-row[data-index="1"]')
            ?.getAttribute('data-row-id')
        const result = await measureInteractionWork(
          async () => {
            table!.setSorting([{ id: 'rank', desc: false }])
            await expect.poll(firstId).not.toBe('r1')
          },
          {
            afterWarmup: async () => {
              table!.setSorting([])
              await expect.poll(firstId).toBe('r1')
              await new Promise(resolve =>
                setTimeout(resolve, MOTION_SETTLE_MS),
              )
            },
          },
        )
        await cleanup()
        return result
      }

      // Раскрытие 100 детей на 1000×1000: кадры, пока строки ниже едут.
      const expand = async (motion: boolean) => {
        const screen = await renderGrid({
          ...LARGE,
          enableRowExpanding: true,
          enableRowAnimation: motion,
          dataOverride: motionTree(),
          initialExpanded: {},
        })
        await waitForGrid()
        const toggle = () =>
          document.querySelector<HTMLElement>(
            '.data-grid__body-row[data-row-id="item-id-0"] .row-expand-button',
          )!
        let started = 0
        const result = await measureTransitionWork(
          async () => {
            started = performance.now()
            toggle().click()
          },
          () => performance.now() - started > MOTION_SETTLE_MS,
        )
        expect(toggle().getAttribute('aria-expanded')).toBe('true')
        await screen.unmount()
        return result
      }

      // Спокойная прокрутка 1000×1000: модель не меняется — движение ничего не стоит.
      const scroll = async (motion: boolean) => {
        const screen = await renderGrid({
          ...LARGE,
          enableRowAnimation: motion,
        })
        await waitForGrid()
        const result = await measureScrollWork('y', CONTENT_SCROLL.y)
        await screen.unmount()
        return result
      }

      const cases = [
        ['sort', sort, 'longestMs', '100 000×2', 'interaction', RM20_SORT_COST],
        ['expand', expand, 'p95Ms', '1000×1000', 'animation', RM20_EXPAND_COST],
        ['scroll', scroll, 'p95Ms', '1000×1000', 'animation', RM20_COST],
      ] as const
      for (const [name, measure, metric, size, kind, cost] of cases) {
        const runs = await againstBase(measure)
        const base = medianRun(runs.base, r => r[metric])
        const variant = medianRun(runs.variant, r => r[metric])
        const ceiling = ceilingOver(base[metric], cost)
        const record = (
          id: string,
          label: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label,
            operation: kind === 'interaction' ? 'interaction' : 'scroll',
            size,
            plugins: 'none',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: kind === 'interaction' ? 'load' : 'animation',
                metric: metric === 'longestMs' ? 'longest' : 'p95',
                valueMs: r[metric],
                targetMs:
                  kind === 'interaction'
                    ? INTERACTION_BUDGET_MS
                    : ANIMATION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        await record(`RM20-${name}-base`, `${name} без движения`, base, false)
        await record(`RM20-${name}`, `${name} с движением строк`, variant, true)
        expect(
          variant[metric],
          `${name}: ${metric}=${variant[metric].toFixed(1)}ms, база ${base[metric].toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 6,
  )
})

// Превью броска строки (ADR 0108, PV7): проекция линий по окну на каждую смену места
// при автопрокрутке над деревом в 100 000 строк — против той же сессии без линий.
const DROP_TREE = makeData({
  shape: 'tree',
  count: 25_000,
  depth: 2,
  breadth: 3,
})
const PV7_COST = { ratio: 1.3, plusMs: 8 }
const PV7_DRAG_MS = 1000

describe('Кадры — превью броска строки', () => {
  test(
    'PV7: перетаскивание с автопрокруткой над раскрытым деревом в 100 000 строк с линиями против той же сессии без линий — p95 кадра до +30 % или 8 мс',
    async () => {
      const session = async (lines: boolean) => {
        const screen = await renderGrid({
          columnCount: 6,
          dataOverride: DROP_TREE,
          enableRowDragging: true,
          enableRowExpanding: true,
          rowExpandingMaxDepth: 1,
          enableTreeLines: lines,
          initialExpanded: true,
        })
        await waitForGrid()
        const scroller = getScroller()
        const handle = document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-index="1"] ${HANDLE}`,
        )!
        const { hx } = await beginDrag(handle)
        const edge = scroller.getBoundingClientRect().bottom - 4
        let started = 0
        const result = await measureTransitionWork(
          async () => {
            started = performance.now()
            firePointer('pointermove', document, hx, edge)
          },
          () => performance.now() - started > PV7_DRAG_MS,
        )
        // Сессия мерила автопрокрутку, а не стоящий грид.
        expect(scroller.scrollTop).toBeGreaterThan(0)
        firePointer('pointerup', document, hx, edge)
        await screen.unmount()
        return result
      }
      const runs = await againstBase(session)
      const base = medianRun(runs.base, r => r.p95Ms)
      const variant = medianRun(runs.variant, r => r.p95Ms)
      const ceiling = ceilingOver(base.p95Ms, PV7_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'scroll',
          size: '100 000 дерево',
          plugins: 'rowDragging, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'animation',
              metric: 'p95',
              valueMs: r.p95Ms,
              targetMs: ANIMATION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('PV7-base', 'перетаскивание без линий', base, false)
      await record('PV7', 'перетаскивание с превью линий', variant, true)
      expect(
        variant.p95Ms,
        `p95=${variant.p95Ms.toFixed(1)}ms, база ${base.p95Ms.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 4,
  )
})

// Перенос в ленивом дереве (ADR 0112, LT12): перестановка ребёнка ленивой группы с
// клавиатуры — строка встаёт стадией исходной модели, промис `onRowDragEnd` ждёт —
// против той же перестановки ребёнка группы, чьи 100 детей лежат в данных, на 100 000
// корней. Прогрев переставляет одного ребёнка, замер — следующего: переставленная
// строка ждёт промиса и не переносится.
const LT12_GROUP = LAZY_ROOTS[0]!
const lt12Child = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      `.data-grid__body-row[data-row-id^='${LT12_GROUP}-k']`,
    ),
  ].find(row => !row.hasAttribute('aria-busy'))
const lt12Move = async () => {
  lt12Child()!.querySelector<HTMLElement>('[data-kn-cell]')!.focus()
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }),
  )
}

describe('Отзывчивость — перенос в ленивом дереве', () => {
  test(
    'LT12: перестановка ребёнка ленивой группы со стадией ожидающих переносов на 100 000 корней не дороже той же перестановки в данных',
    async () => {
      const measure = async (lazy: boolean) => {
        const data = [...getData(SEARCH_SIZE.dataCount)] as {
          id: string
          subRows?: unknown[]
        }[]
        if (!lazy) {
          const at = data.findIndex(row => row.id === LT12_GROUP)
          data[at] = { ...data[at]!, subRows: lazyKids(LT12_GROUP) }
        }
        await renderGrid({
          ...SEARCH_SIZE,
          ...ALL_PLUGINS,
          enableRowExpanding: true,
          dataOverride: data,
          ...(lazy
            ? {
                rowExpandingHasChildren: (row: { id: string }) =>
                  row.id === LT12_GROUP,
                rowExpandingLoadChildren: (row: { id: string }) =>
                  lazyKids(row.id),
              }
            : {}),
          // Промис не выполняется: переставленные строки ждут, ленивые — стадией.
          onRowDragEnd: () => new Promise(() => {}),
        } as Parameters<typeof renderGrid>[0])
        await waitForGrid()
        const toggle = () =>
          document.querySelector<HTMLElement>(
            `.data-grid__body-row[data-row-id='${LT12_GROUP}'] .row-expand-button`,
          )
        await expect.poll(toggle).toBeTruthy()
        toggle()!.click()
        await expect.poll(lt12Child).toBeTruthy()
        const result = await measureInteractionWork(lt12Move, {
          afterWarmup: () =>
            expect(
              document.querySelectorAll(
                `.data-grid__body-row[data-row-id^='${LT12_GROUP}-k'][aria-busy]`,
              ),
            ).toHaveLength(1),
        })
        expect(
          document.querySelectorAll(
            `.data-grid__body-row[data-row-id^='${LT12_GROUP}-k'][aria-busy]`,
          ),
        ).toHaveLength(2)
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const staged = medianRun(runs.variant, r => r.longestMs)
      // Стадия правит только ответ группы — не дороже пересборки данных; запас на шум.
      const ceiling = ceilingOver(base.longestMs, { ratio: 1, plusMs: 30 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×10',
          plugins: 'all',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record(
        'LT12-base',
        'перестановка ребёнка группы в данных, промис ждёт',
        base,
        false,
      )
      await record(
        'LT12',
        'перестановка ребёнка ленивой группы стадией модели',
        staged,
        true,
      )
      expect(
        staged.longestMs,
        `стадия longest=${staged.longestMs.toFixed(1)}ms, база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Движение колонок (ADR 0115, CN13): перенос колонки на 1000×1000 через `setColumnOrder` —
// отзывчивость переноса и кадры, пока колонки едут, — против того же переноса без движения.
// Фокус не трогается: прокрутка к фокусу оборвала бы движение (ADR 0115, «Границы»).
/**
 * Цена движения по ADR 0115, CN13: перенос платит за замер шапки и запуск анимаций ячеек
 * в коммите, кадры движения — за слои композитора едущих ячеек.
 */
const CN13_MOVE_COST = { ratio: 1.45, plusMs: 8 }
const CN13_GLIDE_COST = { ratio: 1.3, plusMs: 12 }
const COLUMN_MOTION_SETTLE_MS = 400
const MOTION_COLUMN_IDS = Array.from({ length: 1000 }, (_, i) => `c${i}`)
const MOTION_GRID_COLUMNS = MOTION_COLUMN_IDS.map((id, i) => ({
  id,
  header: id.toUpperCase(),
  accessorFn: (row: { n: number }) => row.n * 1000 + i,
  size: 150,
}))
const MOTION_GRID_ROWS = Array.from({ length: 1000 }, (_, n) => ({
  id: `r${n}`,
  n,
}))
/** c1 на место c2 — колонка у левого края, видна до и после переноса. */
const MOTION_SWAPPED = ['c0', 'c2', 'c1', ...MOTION_COLUMN_IDS.slice(3)]

describe('Отзывчивость — движение колонок', () => {
  test(
    'CN13: перенос колонки на 1000×1000 с движением против того же без него — перенос до +45 % или 8 мс, самый долгий кадр движения до +30 % или 12 мс',
    async () => {
      const mount = async (motion: boolean) => {
        let table: { setColumnOrder: (order: string[]) => void } | undefined
        const MotionGrid = () => {
          const created = useCreateTable({
            columns: MOTION_GRID_COLUMNS as never,
            data: MOTION_GRID_ROWS,
            getRowId: (row: { id: string }) => row.id,
            enableColumnAnimation: motion,
          })
          table = created as never
          return (
            <div style={{ width: 1200, height: 520 }}>
              <DataGrid table={created} height={500} />
            </div>
          )
        }
        await render(<MotionGrid />)
        await waitForGrid()
        return table!
      }
      const secondId = () =>
        document
          .querySelectorAll<HTMLElement>(
            '.data-grid__head-cell[data-column-id]',
          )[1]
          ?.getAttribute('data-column-id')
      /** Ячейки, которые едут, — анимации `translate` в кадре после переноса. */
      const gliding = () =>
        document
          .getAnimations()
          .filter(animation =>
            (animation.effect as KeyframeEffect)
              .getKeyframes()
              .some(frame => 'translate' in frame),
          ).length

      const move = async (motion: boolean) => {
        const table = await mount(motion)
        const result = await measureInteractionWork(
          async () => {
            table.setColumnOrder(MOTION_SWAPPED)
            await expect.poll(secondId).toBe('c2')
          },
          {
            afterWarmup: async () => {
              table.setColumnOrder([])
              await expect.poll(secondId).toBe('c1')
              await new Promise(resolve =>
                setTimeout(resolve, COLUMN_MOTION_SETTLE_MS),
              )
            },
          },
        )
        await cleanup()
        return result
      }

      // Кадры после коммита, пока колонки едут: цена самого движения. Коммит — в `move`.
      const glide = async (motion: boolean) => {
        const table = await mount(motion)
        const started = performance.now()
        table.setColumnOrder(MOTION_SWAPPED)
        await new Promise(resolve => requestAnimationFrame(resolve))
        const glided = gliding()
        const result = await measureTransitionWork(
          async () => {},
          () => performance.now() - started > COLUMN_MOTION_SETTLE_MS,
        )
        expect(secondId()).toBe('c2')
        expect(glided > 0, 'колонки ехали').toBe(motion)
        await cleanup()
        return result
      }

      const cases = [
        ['move', move, 'longestMs', 'interaction', CN13_MOVE_COST],
        ['glide', glide, 'longestMs', 'animation', CN13_GLIDE_COST],
      ] as const
      for (const [name, measure, metric, kind, cost] of cases) {
        const runs = await againstBase(measure)
        const base = medianRun(runs.base, r => r[metric])
        const variant = medianRun(runs.variant, r => r[metric])
        const ceiling = ceilingOver(base[metric], cost)
        const record = (
          id: string,
          label: string,
          r: typeof base,
          gated: boolean,
        ) =>
          recordPerf({
            id,
            label,
            operation: kind === 'interaction' ? 'interaction' : 'scroll',
            size: '1000×1000',
            plugins: 'none',
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: kind === 'interaction' ? 'load' : 'animation',
                metric: 'longest',
                valueMs: r[metric],
                targetMs:
                  kind === 'interaction'
                    ? INTERACTION_BUDGET_MS
                    : ANIMATION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        await record(`CN13-${name}-base`, `${name} без движения`, base, false)
        await record(
          `CN13-${name}`,
          `${name} с движением колонок`,
          variant,
          true,
        )
        expect(
          variant[metric],
          `${name}: ${metric}=${variant[metric].toFixed(1)}ms, база ${base[metric].toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// Серверная модель строк (ADR 0138, SD32): приход блока из 10 строк при итоге 1 000 000
// против того же прихода при итоге 1000 — работа прихода не растёт с итогом.
interface ServerCall {
  start: number
  end: number
  resolve: (response: { rows: FeedRow[] }) => void
}
let serverCalls: ServerCall[] = []
const SSRM_BLOCK = 10
const ServerGrid = ({ total }: { total: number }) => {
  const table = useCreateTable({
    rowCount: total,
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: SSRM_BLOCK,
        getRows: ({ start, end }) =>
          new Promise<{ rows: FeedRow[] }>(resolve => {
            serverCalls.push({ start, end, resolve })
          }),
      }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}
const NO_FEED: FeedRow[] = []

describe('Отзывчивость взаимодействий — серверная модель строк', () => {
  test(
    'SD32: приход блока при итоге 1 000 000 не дороже того же прихода при итоге 1000',
    async () => {
      const measure = async (large: boolean) => {
        serverCalls = []
        await render(<ServerGrid total={large ? 1_000_000 : 1000} />)
        // В окне — несколько блоков: прогрев и замер принимают по одному.
        await expect.poll(() => serverCalls.length).toBeGreaterThanOrEqual(2)
        /** Первая строка блока с началом `start` — с данными. */
        const arrived = (start: number) =>
          document.querySelector(
            `.data-grid__body-row[data-index="${start}"][data-row-id]`,
          ) !== null
        let answered = 0
        const result = await measureInteractionWork(
          async () => {
            const call = serverCalls[answered++]!
            call.resolve({ rows: feedRows(call.start, call.end - call.start) })
            await expect.poll(() => arrived(call.start)).toBe(true)
          },
          {
            afterWarmup: () => {
              expect(arrived(0)).toBe(true)
              expect(arrived(SSRM_BLOCK)).toBe(false)
            },
          },
        )
        expect(arrived(SSRM_BLOCK)).toBe(true)
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const large = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: gated ? '1 000 000×3' : '1000×3',
          plugins: 'serverRowModel',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SD32-base', 'итог 1000', base, false)
      await record('SD32', 'итог 1 000 000', large, true)
      expect(
        large.longestMs,
        `longest=${large.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Транзакции строк SSRM (ADR 0157, RT12): вставка 100 строк одной транзакцией при итоге
// 1 000 000 против 100 вызовов `setRowData` той же таблицы — пересборка блоков на месте не
// дороже замены строк.
interface TransactionGridTable {
  applyRowTransaction: (transaction: object) => unknown
  setRowData: (id: string, updater: (row: FeedRow) => FeedRow) => void
}
let transactionTable: TransactionGridTable | undefined
const TransactionGrid = () => {
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: 100,
        getRows: ({ start, end }) =>
          Promise.resolve({ rows: feedRows(start, end - start) }),
      }),
    ] as never,
  })
  transactionTable = table as unknown as TransactionGridTable
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — транзакции строк SSRM', () => {
  test(
    'RT12: вставка 100 строк при итоге 1 000 000 не дороже 100 вызовов setRowData',
    async () => {
      const ROWS = 100
      const cell = (index: number) =>
        document.querySelector(
          `.data-grid__body-row[data-index="${index}"] .data-grid__body-cell[data-column-id="a"]`,
        )?.textContent
      const measure = async (insert: boolean) => {
        await render(<TransactionGrid />)
        await expect.poll(() => cell(0)).toBe('Name 0')
        let round = 0
        const result = await measureInteractionWork(async () => {
          const tag = `t${round++}`
          if (insert) {
            transactionTable!.applyRowTransaction({
              add: Array.from({ length: ROWS }, (_, k) => ({
                ...feedRows(k, 1)[0],
                id: `${tag}-${k}`,
                a: `${tag} ${k}`,
              })),
              index: 0,
            })
          } else {
            for (let k = 0; k < ROWS; k++) {
              transactionTable!.setRowData(`f${k}`, row => ({
                ...row,
                a: `${tag} ${k}`,
              }))
            }
          }
          await expect.poll(() => cell(0)).toBe(`${tag} 0`)
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const inserted = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '1 000 000×3',
          plugins: 'serverRowModel',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('RT12-base', '100 × setRowData', base, false)
      await record('RT12', 'транзакция из 100 строк', inserted, true)
      expect(
        inserted.longestMs,
        `longest=${inserted.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Пагинация в SSRM (ADR 0158, SP11): переход между загруженными страницами по 100 строк
// при итоге 1 000 000 против клиентской смены страницы того же размера на 100 000 строк.
const PAGED_ROWS = 100
const CLIENT_PAGED_DATA = feedRows(0, 100_000)
const PagedGrid = ({ server }: { server: boolean }) => {
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: server ? NO_FEED : CLIENT_PAGED_DATA,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              blockSize: PAGED_ROWS,
              getRows: ({ start, end }) =>
                Promise.resolve({ rows: feedRows(start, end - start) }),
            }),
          ]
        : []),
      pagination({ initialPageSize: PAGED_ROWS }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — пагинация SSRM', () => {
  test(
    'SP11: переход на страницу из кэша при итоге 1 000 000 не дороже клиентской смены страницы того же размера',
    async () => {
      const measure = async (server: boolean) => {
        await render(<PagedGrid server={server} />)
        await expect.poll(firstRowId).toBe('f0')
        // Вторая страница загружена до замера: переход — из кэша.
        pageButton('next')!.click()
        await expect.poll(firstRowId).toBe(`f${PAGED_ROWS}`)
        pageButton('previous')!.click()
        await expect.poll(firstRowId).toBe('f0')
        let forward = true
        const result = await measureInteractionWork(async () => {
          pageButton(forward ? 'next' : 'previous')!.click()
          await expect.poll(firstRowId).toBe(forward ? `f${PAGED_ROWS}` : 'f0')
          forward = !forward
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(server => measure(server))
      const base = medianRun(runs.base, r => r.longestMs)
      const paged = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: gated ? '1 000 000×3' : '100 000×3',
          plugins: gated ? 'serverRowModel, pagination' : 'pagination',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SP11-base', 'клиентская смена страницы', base, false)
      await record('SP11', 'страница SSRM из кэша', paged, true)
      expect(
        paged.longestMs,
        `longest=${paged.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Перенос строки в SSRM (ADR 0159, MV11): запись переноса при итоге 1 000 000 против того
// же переноса в клиентском режиме на 100 000 строк — путь броска, меню и клавиш один.
let moveTable: unknown
const CLIENT_MOVE_DATA = feedRows(0, 100_000)
const MoveGrid = ({ server }: { server: boolean }) => {
  const [rows, setRows] = useState(CLIENT_MOVE_DATA)
  const table = useCreateTable({
    rowCount: 1_000_000,
    columns: FEED_COLUMNS as never,
    data: server ? NO_FEED : rows,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              blockSize: 100,
              getRows: ({ start, end }) =>
                Promise.resolve({ rows: feedRows(start, end - start) }),
            }),
          ]
        : []),
      rowDragging({ onRowOrderChange: setRows as never }),
    ] as never,
  })
  moveTable = table
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — перенос строки SSRM', () => {
  test(
    'MV11: бросок при итоге 1 000 000 не дороже броска в клиентском режиме на 100 000 строк',
    async () => {
      const idAt = (index: number) =>
        document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-index="${index}"]`,
        )?.dataset.rowId
      const rowOf = (id: string) =>
        (
          moveTable as {
            getRowSource: () => { byId: (id: string) => unknown }
          }
        )
          .getRowSource()
          .byId(id)
      const measure = async (server: boolean) => {
        await render(<MoveGrid server={server} />)
        await expect.poll(() => idAt(2)).toBe('f2')
        let down = true
        const result = await measureInteractionWork(async () => {
          moveRow(rowOf('f2'), moveTable, down ? 1 : -1)
          await expect.poll(() => idAt(down ? 3 : 2)).toBe('f2')
          down = !down
        })
        await cleanup()
        return result
      }
      const runs = await againstBase(server => measure(server))
      const base = medianRun(runs.base, r => r.longestMs)
      const moved = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 10 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: gated ? '1 000 000×3' : '100 000×3',
          plugins: gated ? 'serverRowModel, rowDragging' : 'rowDragging',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('MV11-base', 'перенос строки на клиенте', base, false)
      await record('MV11', 'перенос строки SSRM', moved, true)
      expect(
        moved.longestMs,
        `longest=${moved.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Ленивые дети в SSRM (ADR 0138, SD46): раскрытие ветки со 100 детьми при 1 000 000 корней
// против того же раскрытия при 1000 корней. Цена — пересчёт размеров виртуализатора на
// миллион строк (§14): он растёт с числом строк, раскладка веток — нет.
interface ServerTreeCall {
  start: number
  end: number
  parentId?: string
  resolve: (response: { rows: FeedRow[]; rowCount?: number }) => void
}
let treeCalls: ServerTreeCall[] = []
const BRANCH = 100
const ServerTreeGrid = ({ total }: { total: number }) => {
  const table = useCreateTable({
    rowCount: total,
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: BRANCH,
        getRows: ({ start, end, parentId }) =>
          new Promise<{ rows: FeedRow[]; rowCount?: number }>(resolve => {
            treeCalls.push({ start, end, parentId, resolve })
          }),
      }),
      rowExpanding({ hasChildren: row => row.depth === 0 }),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

/** Раскрытие ветки со 100 детьми при 1 000 000 корней или при 1000. */
const measureServerBranch = async (large: boolean) => {
  treeCalls = []
  await render(<ServerTreeGrid total={large ? 1_000_000 : 1000} />)
  await expect.poll(() => treeCalls.length).toBeGreaterThanOrEqual(1)
  const roots = treeCalls[0]!
  roots.resolve({ rows: feedRows(roots.start, roots.end - roots.start) })
  const rowOf = (id: string) =>
    document.querySelector<HTMLElement>(
      `.data-grid__body-row[data-row-id="${id}"]`,
    )
  const toggleOf = (id: string) =>
    rowOf(id)!.querySelector<HTMLElement>('.row-expand-button')!
  await expect.poll(() => rowOf('f1')).not.toBeNull()
  const parents = ['f0', 'f1']
  let expanded = 0
  const result = await measureInteractionWork(
    async () => {
      const id = parents[expanded++]!
      const asked = treeCalls.length
      toggleOf(id).click()
      await expect.poll(() => treeCalls.length).toBe(asked + 1)
      const call = treeCalls.at(-1)!
      call.resolve({
        rows: feedRows(0, BRANCH).map((row, k) => ({
          ...row,
          id: `${id}.${k}`,
        })),
        rowCount: BRANCH,
      })
      await expect.poll(() => rowOf(`${id}.0`)).not.toBeNull()
    },
    {
      // Ветка строки 0 свёрнута — строка 1 снова в окне.
      afterWarmup: async () => {
        expect(treeCalls.at(-1)!.parentId).toBe('f0')
        toggleOf('f0').click()
        await expect.poll(() => rowOf('f0.0')).toBeNull()
      },
    },
  )
  expect(treeCalls.at(-1)!.parentId).toBe('f1')
  await cleanup()
  return result
}

describe('Отзывчивость взаимодействий — ленивые дети серверной модели строк', () => {
  test(
    'SD46: раскрытие ветки со 100 детьми при 1 000 000 корней не дороже того же раскрытия при 1000 корней плюс 60 мс',
    async () => {
      const runs = await againstBase(measureServerBranch)
      const base = medianRun(runs.base, r => r.longestMs)
      const large = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 60 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: gated ? '1 000 000×3' : '1000×3',
          plugins: 'serverRowModel, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('SD46-base', '1000 корней', base, false)
      await record('SD46', '1 000 000 корней', large, true)
      expect(
        large.longestMs,
        `longest=${large.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// «Раскрыть всё» в SSRM (ADR 0160, EA11): кнопка в шапке при 1 000 000 корней против
// раскрытия одной ветки (замер SD46) — детей просят только ветки окна.
/** Кнопкой «Раскрыть всё» при 1 000 000 корней: работа и запросы веток. */
const measureServerExpandAll = async () => {
  treeCalls = []
  await render(<ServerTreeGrid total={1_000_000} />)
  await expect.poll(() => treeCalls.length).toBeGreaterThanOrEqual(1)
  const roots = treeCalls[0]!
  roots.resolve({ rows: feedRows(roots.start, roots.end - roots.start) })
  const rowOf = (id: string) =>
    document.querySelector<HTMLElement>(
      `.data-grid__body-row[data-row-id="${id}"]`,
    )
  const button = () =>
    document.querySelector<HTMLElement>('.row-expand-all-button')!
  await expect.poll(() => rowOf('f1')).not.toBeNull()
  const answerBranches = () => {
    for (const call of treeCalls) {
      if (!call.parentId) continue
      call.resolve({
        rows: feedRows(0, BRANCH).map((row, k) => ({
          ...row,
          id: `${call.parentId}.${k}`,
        })),
        rowCount: BRANCH,
      })
    }
  }
  const result = await measureInteractionWork(
    // Ветка окна приходит ответом, при повторе — из кэша.
    async () => {
      button().click()
      await expect
        .poll(() => {
          answerBranches()
          return rowOf('f0.0')
        })
        .not.toBeNull()
    },
    {
      // «Свернуть всё» — та же кнопка: замер снова раскрывает всё.
      afterWarmup: async () => {
        button().click()
        await expect.poll(() => rowOf('f0.0')).toBeNull()
      },
    },
  )
  // Ветки окна ответили — новых запросов нет: окно занимает ветка первой строки.
  await new Promise(resolve => setTimeout(resolve, 200))
  const branchRequests = treeCalls.filter(call => call.parentId).length
  await cleanup()
  return { ...result, branchRequests }
}

describe('Отзывчивость взаимодействий — «раскрыть всё» в серверной модели строк', () => {
  test(
    'EA11: «раскрыть всё» в SSRM при 1 000 000 корней — запросов не больше, чем блоков окна; кадр не дороже раскрытия одной ветки (как SD46)',
    async () => {
      const runs = await againstBase(variant =>
        variant
          ? measureServerExpandAll()
          : measureServerBranch(true).then(run => ({
              ...run,
              branchRequests: 0,
            })),
      )
      const base = medianRun(runs.base, r => r.longestMs)
      const all = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.3, plusMs: 30 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '1 000 000×3',
          plugins: 'serverRowModel, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('EA11-base', 'раскрытие одной ветки', base, false)
      await record('EA11', '«раскрыть всё»', all, true)
      // Блок ветки — 100 строк: окно в 600px целиком в ветке первой строки.
      for (const run of runs.variant) {
        expect(run.branchRequests).toBeGreaterThan(0)
        expect(run.branchRequests).toBeLessThanOrEqual(2)
      }
      expect(
        all.longestMs,
        `longest=${all.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Подсказка виртуализатору (ADR 0145, HV8): раскрытие ветки при 1 000 000 корней в SSRM и
// дописывание 100 строк к 100 000 в ленте — с подсказкой против сверки ключей.
const HV8_CASES = [
  {
    id: 'HV8-ssrm',
    label: 'раскрытие ветки при 1 000 000 корней',
    size: '1 000 000×3',
    plugins: 'serverRowModel, rowExpanding',
    measure: () => measureServerBranch(true),
  },
  {
    id: 'HV8-feed',
    label: 'дописать 100 строк к 100 000',
    size: '100 000×3',
    plugins: 'infiniteScroll',
    measure: () => measureFeed(true),
  },
] as const
/** С подсказкой — не меньше чем на 5 % дешевле сверки (замер 2026-10-27: 17–20 %). */
const HV8_GAIN = 0.95
describe('Отзывчивость взаимодействий — подсказка виртуализатору', () => {
  test(
    'HV8: раскрытие ветки при 1 000 000 корней в SSRM и дописывание 100 строк к 100 000 в ленте с подсказкой не меньше чем на 5 % дешевле, чем со сверкой ключей',
    async () => {
      const results: string[] = []
      for (const { id, label, size, plugins, measure } of HV8_CASES) {
        const runs = await againstBase(async (hinted: boolean) => {
          rowChangeHints.enabled = hinted
          try {
            return await measure()
          } finally {
            rowChangeHints.enabled = true
          }
        })
        const base = medianRun(runs.base, r => r.longestMs)
        const hinted = medianRun(runs.variant, r => r.longestMs)
        const ceiling = base.longestMs * HV8_GAIN
        const record = (suffix: string, r: typeof base, gated: boolean) =>
          recordPerf({
            id: `${id}${suffix}`,
            label: `${label}, ${gated ? 'подсказка' : 'сверка ключей'}`,
            operation: 'interaction',
            size,
            plugins,
            cpuThrottle: CPU_THROTTLE_RATE,
            metrics: [
              {
                kind: 'load',
                metric: 'longest',
                valueMs: r.longestMs,
                targetMs: INTERACTION_BUDGET_MS,
                ceilingMs: gated ? ceiling : undefined,
                ...r,
              },
            ],
          })
        await record('-base', base, false)
        await record('', hinted, true)
        results.push(
          `${id}: подсказка ${hinted.longestMs.toFixed(1)}ms, сверка ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)}ms`,
        )
        expect(hinted.longestMs, results.at(-1)).toBeLessThanOrEqual(ceiling)
      }
    },
    PERF_TIMEOUT * 4,
  )
})

// Серверная группировка (ADR 0144, GS12): раскрытие группы со 100 строками при 100 000 групп
// против раскрытия ленивой ветки со 100 детьми при 100 000 корней (как SD46).
const GS12_ROOTS = 100_000
interface GroupCall extends ServerTreeCall {
  groupKeys: unknown[]
}
let groupCalls: GroupCall[] = []
const ServerGroupedGrid = () => {
  const table = useCreateTable({
    columns: FEED_COLUMNS as never,
    data: NO_FEED,
    getRowId: (row: FeedRow) => row.id,
    plugins: [
      serverRowModel({
        blockSize: BRANCH,
        getGroupChildCount: () => BRANCH,
        getRows: ({ start, end, parentId, groupKeys }) =>
          new Promise<{ rows: FeedRow[]; rowCount?: number }>(resolve => {
            groupCalls.push({ start, end, parentId, groupKeys, resolve })
          }),
      }),
      rowGrouping({ initialGrouping: ['a'] }),
      rowExpanding(),
    ] as never,
  })
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}

describe('Отзывчивость взаимодействий — серверная группировка', () => {
  test(
    'GS12: раскрытие группы при 100 000 групп не дороже раскрытия ветки при 100 000 корней больше чем на 15 % (или 20 мс)',
    async () => {
      const rowOf = (id: string) =>
        document.querySelector<HTMLElement>(
          `.data-grid__body-row[data-row-id='${id}']`,
        )
      const toggleOf = (id: string) =>
        rowOf(id)!.querySelector<HTMLElement>('.row-expand-button')!
      const measure = async (grouped: boolean) => {
        treeCalls = []
        groupCalls = []
        const calls = () => (grouped ? groupCalls : treeCalls)
        await render(
          grouped ? (
            <ServerGroupedGrid />
          ) : (
            <ServerTreeGrid total={GS12_ROOTS} />
          ),
        )
        await expect.poll(() => calls().length).toBeGreaterThanOrEqual(1)
        const roots = calls()[0]!
        const rows = feedRows(roots.start, roots.end - roots.start)
        roots.resolve({
          rows: grouped ? rows.map(row => ({ ...row, id: '' })) : rows,
          rowCount: GS12_ROOTS,
        })
        const parents = grouped
          ? [
              `group:${JSON.stringify([rows[0]!.a])}`,
              `group:${JSON.stringify([rows[1]!.a])}`,
            ]
          : ['f0', 'f1']
        await expect.poll(() => rowOf(parents[1]!)).not.toBeNull()
        let expanded = 0
        const result = await measureInteractionWork(
          async () => {
            const id = parents[expanded++]!
            const asked = calls().length
            toggleOf(id).click()
            await expect.poll(() => calls().length).toBe(asked + 1)
            const call = calls().at(-1)!
            call.resolve({
              rows: feedRows(0, BRANCH).map((row, k) => ({
                ...row,
                id: `${id}.${k}`,
              })),
              rowCount: BRANCH,
            })
            await expect.poll(() => rowOf(`${id}.0`)).not.toBeNull()
          },
          {
            // Ветка первой строки свёрнута — вторая снова в окне.
            afterWarmup: async () => {
              expect(calls().at(-1)!.parentId).toBe(parents[0])
              toggleOf(parents[0]!).click()
              await expect.poll(() => rowOf(`${parents[0]}.0`)).toBeNull()
            },
          },
        )
        expect(calls().at(-1)!.parentId).toBe(parents[1])
        if (grouped) {
          expect(groupCalls.at(-1)!.groupKeys).toEqual([rows[1]!.a])
        }
        await cleanup()
        return result
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const grouped = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, { ratio: 1.15, plusMs: 20 })
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '100 000×3',
          plugins: gated
            ? 'serverRowModel, rowGrouping, rowExpanding'
            : 'serverRowModel, rowExpanding',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('GS12-base', 'ветка при 100 000 корней', base, false)
      await record('GS12', 'группа при 100 000 групп', grouped, true)
      expect(
        grouped.longestMs,
        `longest=${grouped.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})

// Копирование в серверной модели строк (ADR 0146, XC15): сборка буфера 10 000 строк × 10
// колонок с догрузкой строк (мгновенный ответ) против той же копии в клиентском режиме.
const XC15_ROWS = 10_000
const XC15_COLUMNS = Array.from({ length: 10 }, (_, k) => ({
  id: `c${k}`,
  accessorKey: `c${k}`,
  header: `C${k}`,
}))
type CopyRow = Record<string, string> & { id: string }
let copyPool: CopyRow[] | undefined
const copyRowsOf = () =>
  (copyPool ??= Array.from({ length: XC15_ROWS }, (_, i) => {
    const row: CopyRow = { id: `x${i}` }
    for (let k = 0; k < 10; k++) row[`c${k}`] = `v${i}-${k}`
    return row
  }))
const NO_COPY_ROWS: CopyRow[] = []
let copyTable: { selectAllCells: () => void } | undefined
const CopyGrid = ({ server }: { server: boolean }) => {
  const table = useCreateTable({
    rowCount: XC15_ROWS,
    columns: XC15_COLUMNS as never,
    data: server ? NO_COPY_ROWS : copyRowsOf(),
    getRowId: (row: CopyRow) => row.id,
    plugins: [
      ...(server
        ? [
            serverRowModel({
              getRows: ({ start, end }) => ({
                rows: copyRowsOf().slice(start, end),
              }),
            }),
          ]
        : []),
      cellSelection(),
    ] as never,
  })
  copyTable = table as never
  return (
    <div style={{ height: 600 }}>
      <DataGrid table={table as never} />
    </div>
  )
}
const XC15_COST = { ratio: 1.3, plusMs: 40 }

describe('Отзывчивость взаимодействий — копирование в серверной модели строк', () => {
  test(
    'XC15: сборка буфера 10 000 строк × 10 колонок в SSRM не дороже той же копии в клиентском режиме',
    async () => {
      const clipboard = navigator.clipboard
      const measure = async (server: boolean) => {
        let written: string[] = []
        // Окно теста писать в буфер не вправе: запись подменена, текст сохраняется.
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            write: async (items: ClipboardItem[]) => {
              for (const item of items) {
                written.push(await (await item.getType('text/plain')).text())
              }
            },
            writeText: async (text: string) => {
              written.push(text)
            },
          },
        })
        try {
          await render(<CopyGrid server={server} />)
          await waitForGrid()
          copyTable!.selectAllCells()
          const result = await measureInteractionWork(async () => {
            written = []
            const clipboardData = new DataTransfer()
            document
              .querySelector('.data-grid__body-cell[data-column-id="c0"]')!
              .dispatchEvent(
                new ClipboardEvent('copy', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData,
                }),
              )
            const sync = clipboardData.getData('text/plain')
            if (sync) written.push(sync)
            await expect.poll(() => written.length).toBe(1)
          })
          // Замер копировал всё выделение.
          expect(written[0]!.split('\n')).toHaveLength(XC15_ROWS)
          await cleanup()
          return result
        } finally {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: clipboard,
          })
        }
      }
      const runs = await againstBase(measure)
      const base = medianRun(runs.base, r => r.longestMs)
      const server = medianRun(runs.variant, r => r.longestMs)
      const ceiling = ceilingOver(base.longestMs, XC15_COST)
      const record = (
        id: string,
        label: string,
        r: typeof base,
        gated: boolean,
      ) =>
        recordPerf({
          id,
          label,
          operation: 'interaction',
          size: '10 000×10',
          plugins: gated ? 'serverRowModel, cellSelection' : 'cellSelection',
          cpuThrottle: CPU_THROTTLE_RATE,
          metrics: [
            {
              kind: 'load',
              metric: 'longest',
              valueMs: r.longestMs,
              targetMs: INTERACTION_BUDGET_MS,
              ceilingMs: gated ? ceiling : undefined,
              ...r,
            },
          ],
        })
      await record('XC15-base', 'клиентский режим', base, false)
      await record('XC15', 'серверная модель, догрузка строк', server, true)
      expect(
        server.longestMs,
        `longest=${server.longestMs.toFixed(1)}ms (база ${base.longestMs.toFixed(1)}ms, потолок ${ceiling.toFixed(1)})`,
      ).toBeLessThanOrEqual(ceiling)
    },
    PERF_TIMEOUT * 2,
  )
})
